import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";
import { encrypt, safeDecrypt } from "@/lib/crypto";
import { QBOTokens } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/login?error=intuit_denied", req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString("base64");

    const { data: tokens } = await axios.post<QBOTokens & {
      id_token?: string;
      x_refresh_token_expires_in?: number;
    }>(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QBO_REDIRECT_URI!,
      }).toString(),
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Fetch OpenID user info to get Intuit identity
    const { data: userInfo } = await axios.get<{
      sub: string;
      email: string;
      emailVerified?: boolean;
      email_verified?: boolean;
      givenName?: string;
      familyName?: string;
    }>(
      "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } }
    );

    // Check emailVerified — REQUIRED by Intuit
    const emailVerified = userInfo.emailVerified ?? userInfo.email_verified ?? false;
    if (!emailVerified) {
      return NextResponse.redirect(new URL("/login?error=email_not_verified", req.url));
    }

    const intuitSub = userInfo.sub; // This is the stable Intuit identity — use this, NOT email
    const db = getServiceSupabase();

    let userId: string;
    let firmId: string;

    // "add_company" state: already logged in, just adding another QBO company
    const isAddCompany = state === "add_company";

    // Parse state FIRST so isReturningUser is available throughout
    let isReturningUser = false;
    let redirectPath = "/dashboard";
    if (state.startsWith("sso_")) {
      try {
        const decoded = Buffer.from(state.replace("sso_", ""), "base64").toString("utf8");
        if (decoded.startsWith("{")) {
          const parsed = JSON.parse(decoded);
          redirectPath = parsed.returnTo ?? "/dashboard";
          isReturningUser = parsed.returning ?? false;
        } else {
          redirectPath = decoded;
        }
        if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) redirectPath = "/dashboard";
      } catch { redirectPath = "/dashboard"; }
    }

    const cookieUserId = req.cookies.get("user_id")?.value ?? req.cookies.get("sb_access_token")?.value;
    const cookieFirmId = req.cookies.get("firm_id")?.value;

    if (isAddCompany && cookieUserId && cookieFirmId) {
      userId = cookieUserId;
      firmId = cookieFirmId;
    } else {
    // Find or create Supabase user by intuit_sub
    let { data: existingUser } = await db
      .from("intuit_users")
      .select("user_id, firm_id")
      .eq("intuit_sub", intuitSub)
      .single();

    if (existingUser) {
      // Returning user — restore identity
      userId = existingUser.user_id;
      firmId = existingUser.firm_id;

      // If no realmId (pure SSO sign-in, no QBO connection), go straight to dashboard
      if (!realmId) {
        const { data: lastTenant } = await db
          .from("tenants")
          .select("id")
          .eq("firm_id", firmId)
          .eq("qbo_connected", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        return buildResponse(req, { userId }, firmId, lastTenant?.id ?? null, "/dashboard", intuitSub);
      }
      // Has realmId — fall through to upsert the QBO connection below
    } else {
      // New user — create Supabase auth user + firm
      const { data: newAuthUser, error: createError } = await db.auth.admin.createUser({
        email: userInfo.email,
        email_confirm: true,
        user_metadata: { intuit_sub: intuitSub },
      });

      if (createError || !newAuthUser.user) {
        // User may already exist in auth (different flow) — look up by email
        const { data: { users } } = await db.auth.admin.listUsers();
        const existingAuthUser = users.find(u => u.email === userInfo.email);
        if (!existingAuthUser) {
          console.error("Failed to create user:", createError);
          return NextResponse.redirect(new URL("/login?error=account_error", req.url));
        }
        userId = existingAuthUser.id;
      } else {
        userId = newAuthUser.user.id;
      }

      // Create firm
      const { data: newFirm } = await db
        .from("firms")
        .insert({ name: userInfo.email, owner_user_id: userId })
        .select("id")
        .single();

      firmId = newFirm!.id;

      // Store intuit_sub -> user mapping
      await db.from("intuit_users").insert({
        intuit_sub: intuitSub,
        user_id: userId,
        firm_id: firmId,
        email: userInfo.email,
      });
    }

    // Sign in as the user to get a valid session token
    // We use Supabase admin to generate a one-time link and then exchange it
    // Since SSO users have no password, we store user_id directly in a secure cookie
    const sessionData = { userId };

    // Handle QBO company connection (only if realmId present)
    let tenantId: string | null = null;

    // Check if reconnect
    const isReconnect = state.startsWith("reconnect_");
    const reconnectTenantId = isReconnect ? state.replace("reconnect_", "") : null;

    if (realmId) {
      const encryptedRefreshToken = encrypt(tokens.refresh_token);

      // Upsert tenant first so we have a real tenant ID for company name fetch
      const upsertData = {
        qbo_realm_id: realmId,
        user_id: userId,
        firm_id: firmId,
        company_name: null as string | null,
        qbo_access_token: tokens.access_token,
        qbo_refresh_token: encryptedRefreshToken,
        qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        qbo_connected: true,
      };

      let tenant;
      if (reconnectTenantId) {
        const result = await db.from("tenants").update(upsertData).eq("id", reconnectTenantId).select().single();
        tenant = result.data;
        // Fetch company name with real tenant ID
        if (tenant && !tenant.company_name) {
          try {
            const info = await fetchCompanyInfo(tenant.id, realmId, tokens.access_token, tokens.refresh_token);
            console.log("fetchCompanyInfo result:", JSON.stringify(info));
            if (info?.CompanyName) {
              await db.from("tenants").update({ company_name: info.CompanyName }).eq("id", tenant.id);
              tenant.company_name = info.CompanyName;
            }
          } catch (companyErr) { console.error("fetchCompanyInfo failed:", companyErr); }
        }

        // Stripe: swap archive → active
        const { data: firm } = await db.from("firms").select("stripe_subscription_id").eq("id", firmId).single();
        if (firm?.stripe_subscription_id) {
          try {
            const { stripe } = await import("@/lib/stripe");
            const sub = await stripe.subscriptions.retrieve(firm.stripe_subscription_id);
            const activeItem = sub.items.data.find(i => i.price.id === process.env.STRIPE_PRICE_ID);
            const archiveItem = sub.items.data.find(i => i.price.id === process.env.STRIPE_ARCHIVE_PRICE_ID);
            const items: object[] = [];
            if (activeItem) {
              items.push({ id: activeItem.id, quantity: (activeItem.quantity ?? 0) + 1 });
            } else {
              items.push({ price: process.env.STRIPE_PRICE_ID!, quantity: 1 });
            }
            if (archiveItem && (archiveItem.quantity ?? 1) > 1) {
              items.push({ id: archiveItem.id, quantity: (archiveItem.quantity ?? 1) - 1 });
            } else if (archiveItem) {
              items.push({ id: archiveItem.id, deleted: true });
            }
            await stripe.subscriptions.update(firm.stripe_subscription_id, { items } as Parameters<typeof stripe.subscriptions.update>[1]);
          } catch (e) { console.error("Stripe reconnect update failed:", e); }
        }
      } else {
        const result = await db.from("tenants").upsert(upsertData, { onConflict: "qbo_realm_id" }).select().single();
        tenant = result.data;
        // Fetch company name with real tenant ID
        if (tenant && !tenant.company_name) {
          try {
            const info = await fetchCompanyInfo(tenant.id, realmId, tokens.access_token, tokens.refresh_token);
            console.log("fetchCompanyInfo result:", JSON.stringify(info));
            if (info?.CompanyName) {
              await db.from("tenants").update({ company_name: info.CompanyName }).eq("id", tenant.id);
              tenant.company_name = info.CompanyName;
            }
          } catch (companyErr) { console.error("fetchCompanyInfo failed:", companyErr); }
        }
      }

      if (tenant) {
        tenantId = tenant.id;

        if (!reconnectTenantId) {
          if (isAddCompany) {
            // Coming from dashboard nav — assume client, mark as such, go straight to Stripe
            await db.from("tenants").update({ is_firm_company: false }).eq("id", tenantId);
            const response = buildResponse(req, { userId }, firmId, tenantId, "/subscription/new", intuitSub);
            return response;
          } else if (isReturningUser) {
            // Returning user via OAuth fallback — skip classify, go to dashboard
            const response = buildResponse(req, { userId }, firmId, tenantId, "/dashboard", intuitSub);
            return response;
          } else {
            // First-time sign in — ask firm vs client
            const classifyUrl = "/connect-type?tenantId=" + tenantId;
            const response = buildResponse(req, { userId }, firmId, tenantId, classifyUrl, intuitSub);
            return response;
          }
        }
      }
    }

    // redirectPath and isReturningUser already parsed above

    // Default to firm company for tenant_id cookie if available
    let defaultTenantId = tenantId;
    if (!defaultTenantId || defaultTenantId !== tenantId) {
      const { data: firmTenant } = await db
        .from("tenants")
        .select("id")
        .eq("firm_id", firmId)
        .eq("is_firm_company", true)
        .eq("qbo_connected", true)
        .limit(1)
        .single();
      if (firmTenant) defaultTenantId = firmTenant.id;
    }

    // If no tenant yet (SSO-only, no QBO connected), go to dashboard which will prompt connect
    return buildResponse(req, { userId }, firmId, defaultTenantId, redirectPath, intuitSub);

  } catch (err) {
    console.error("QBO/SSO callback error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
}

function buildResponse(
  req: NextRequest,
  sessionData: { userId: string },
  firmId: string,
  tenantId: string | null,
  redirectPath: string,
  intuitSubValue?: string
) {
  const response = NextResponse.redirect(new URL(redirectPath, req.url));

  // Store user identity in secure httpOnly cookie (no password needed for SSO users)
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

  response.cookies.set("user_id", sessionData.userId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("sb_access_token", sessionData.userId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("firm_id", firmId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });

  if (tenantId) {
    response.cookies.set("tenant_id", tenantId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  }

  if (intuitSubValue) {
    // Store intuit_sub for 1 year so returning users can skip OAuth company select
    response.cookies.set("intuit_sub", intuitSubValue, { ...cookieOpts, maxAge: 60 * 60 * 24 * 365 });
  }

  return response;
}

