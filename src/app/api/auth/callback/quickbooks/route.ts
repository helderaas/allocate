import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";
import { encrypt } from "@/lib/crypto";
import { QBOTokens } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntuitTokens extends QBOTokens {
  id_token?: string;
  x_refresh_token_expires_in?: number;
}

interface IntuitUserInfo {
  sub: string;
  email: string;
  emailVerified?: boolean;
  email_verified?: boolean;
  givenName?: string;
  familyName?: string;
}

interface ParsedState {
  returnTo: string;
  returning: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseState(state: string): { isAddCompany: boolean; isReconnect: boolean; reconnectTenantId: string | null; parsed: ParsedState } {
  if (state === "add_company") {
    return { isAddCompany: true, isReconnect: false, reconnectTenantId: null, parsed: { returnTo: "/dashboard", returning: false } };
  }
  if (state.startsWith("reconnect_")) {
    return { isAddCompany: false, isReconnect: true, reconnectTenantId: state.replace("reconnect_", ""), parsed: { returnTo: "/dashboard", returning: false } };
  }
  if (state.startsWith("sso_")) {
    try {
      const decoded = Buffer.from(state.replace("sso_", ""), "base64").toString("utf8");
      if (decoded.startsWith("{")) {
        const p = JSON.parse(decoded) as ParsedState;
        const returnTo = p.returnTo?.startsWith("/") && !p.returnTo.startsWith("//") ? p.returnTo : "/dashboard";
        return { isAddCompany: false, isReconnect: false, reconnectTenantId: null, parsed: { returnTo, returning: p.returning ?? false } };
      }
      const returnTo = decoded.startsWith("/") && !decoded.startsWith("//") ? decoded : "/dashboard";
      return { isAddCompany: false, isReconnect: false, reconnectTenantId: null, parsed: { returnTo, returning: false } };
    } catch {
      return { isAddCompany: false, isReconnect: false, reconnectTenantId: null, parsed: { returnTo: "/dashboard", returning: false } };
    }
  }
  return { isAddCompany: false, isReconnect: false, reconnectTenantId: null, parsed: { returnTo: "/dashboard", returning: false } };
}

function buildResponse(
  req: NextRequest,
  userId: string,
  firmId: string,
  tenantId: string | null,
  redirectPath: string,
  intuitSub?: string
): NextResponse {
  const response = NextResponse.redirect(new URL(redirectPath, req.url));
  const isProd = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };

  response.cookies.set("user_id", userId, opts);
  response.cookies.set("sb_access_token", userId, opts);
  response.cookies.set("firm_id", firmId, opts);
  if (tenantId) response.cookies.set("tenant_id", tenantId, opts);
  if (intuitSub) response.cookies.set("intuit_sub", intuitSub, { ...opts, maxAge: 60 * 60 * 24 * 365 });

  return response;
}

async function fetchAndSaveCompanyName(
  db: ReturnType<typeof getServiceSupabase>,
  tenantId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  try {
    const info = await fetchCompanyInfo(tenantId, realmId, accessToken, refreshToken);
    if (info?.CompanyName) {
      await db.from("tenants").update({ company_name: info.CompanyName }).eq("id", tenantId);
    }
  } catch (e) {
    console.error("fetchCompanyInfo failed:", e);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state") ?? "";
  const error = searchParams.get("error");

  if (error) return NextResponse.redirect(new URL("/login?error=intuit_denied", req.url));
  if (!code) return NextResponse.redirect(new URL("/login?error=missing_code", req.url));

  try {
    const { isAddCompany, isReconnect, reconnectTenantId, parsed } = parseState(state);
    const { returnTo, returning: isReturningUser } = parsed;

    // ── Exchange code for tokens ──────────────────────────────────────────────
    const credentials = Buffer.from(`${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`).toString("base64");

    const { data: tokens } = await axios.post<IntuitTokens>(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.QBO_REDIRECT_URI! }).toString(),
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // ── Fetch Intuit identity ─────────────────────────────────────────────────
    const { data: userInfo } = await axios.get<IntuitUserInfo>(
      "https://accounts.platform.intuit.com/v1/openid_connect/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } }
    );

    // emailVerified is REQUIRED by Intuit
    if (!(userInfo.emailVerified ?? userInfo.email_verified)) {
      return NextResponse.redirect(new URL("/login?error=email_not_verified", req.url));
    }

    const intuitSub = userInfo.sub;
    const db = getServiceSupabase();

    // ── Resolve user & firm identity ──────────────────────────────────────────
    let userId: string;
    let firmId: string;

    if (isAddCompany) {
      // Already logged in — use cookies
      userId = req.cookies.get("user_id")?.value ?? req.cookies.get("sb_access_token")?.value ?? "";
      firmId = req.cookies.get("firm_id")?.value ?? "";
      if (!userId || !firmId) return NextResponse.redirect(new URL("/login?error=session_expired", req.url));
    } else {
      const { data: existingUser } = await db
        .from("intuit_users")
        .select("user_id, firm_id")
        .eq("intuit_sub", intuitSub)
        .single();

      if (existingUser) {
        userId = existingUser.user_id;
        firmId = existingUser.firm_id;

        // Returning user with no new QBO connection — restore session and go to dashboard
        if (!realmId) {
          const { data: tenant } = await db.from("tenants").select("id").eq("firm_id", firmId)
            .eq("is_firm_company", true).eq("qbo_connected", true).single();
          return buildResponse(req, userId, firmId, tenant?.id ?? null, "/dashboard", intuitSub);
        }
        // Has realmId — fall through to upsert QBO connection below
      } else {
        // New user — create Supabase auth user + firm
        let newUserId: string;
        const { data: newAuth, error: createError } = await db.auth.admin.createUser({
          email: userInfo.email,
          email_confirm: true,
          user_metadata: { intuit_sub: intuitSub },
        });

        if (createError || !newAuth.user) {
          const { data: { users } } = await db.auth.admin.listUsers();
          const existing = users.find(u => u.email === userInfo.email);
          if (!existing) {
            console.error("Failed to create user:", createError);
            return NextResponse.redirect(new URL("/login?error=account_error", req.url));
          }
          newUserId = existing.id;
        } else {
          newUserId = newAuth.user.id;
        }

        const { data: newFirm } = await db.from("firms")
          .insert({ name: userInfo.email, owner_user_id: newUserId })
          .select("id").single();

        firmId = newFirm!.id;
        userId = newUserId;

        await db.from("intuit_users").insert({
          intuit_sub: intuitSub,
          user_id: userId,
          firm_id: firmId,
          email: userInfo.email,
        });
      }
    }

    // ── Upsert QBO company connection ─────────────────────────────────────────
    if (!realmId) {
      // No QBO company selected — go to dashboard
      const { data: firmTenant } = await db.from("tenants").select("id")
        .eq("firm_id", firmId).eq("is_firm_company", true).eq("qbo_connected", true).single();
      return buildResponse(req, userId, firmId, firmTenant?.id ?? null, returnTo, intuitSub);
    }

    const encryptedRefreshToken = encrypt(tokens.refresh_token);
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
      const { data } = await db.from("tenants").update(upsertData).eq("id", reconnectTenantId).select().single();
      tenant = data;
      // Handle Stripe: swap archive → active
      await handleStripeReconnect(db, firmId);
    } else {
      const { data } = await db.from("tenants").upsert(upsertData, { onConflict: "qbo_realm_id" }).select().single();
      tenant = data;
    }

    if (!tenant) return NextResponse.redirect(new URL("/login?error=tenant_error", req.url));

    // Fetch company name now that we have a real tenant ID
    await fetchAndSaveCompanyName(db, tenant.id, realmId, tokens.access_token, tokens.refresh_token);

    // ── Route based on flow type ──────────────────────────────────────────────
    if (reconnectTenantId) {
      // Reconnect — default to firm company
      const { data: firmTenant } = await db.from("tenants").select("id")
        .eq("firm_id", firmId).eq("is_firm_company", true).eq("qbo_connected", true).single();
      return buildResponse(req, userId, firmId, firmTenant?.id ?? tenant.id, "/dashboard", intuitSub);
    }

    if (isAddCompany) {
      // Adding client from dashboard — skip classify, go to Stripe
      await db.from("tenants").update({ is_firm_company: false }).eq("id", tenant.id);
      return buildResponse(req, userId, firmId, tenant.id, "/subscription/new", intuitSub);
    }

    if (isReturningUser) {
      // Returning user OAuth fallback — skip classify
      const { data: firmTenant } = await db.from("tenants").select("id")
        .eq("firm_id", firmId).eq("is_firm_company", true).eq("qbo_connected", true).single();
      return buildResponse(req, userId, firmId, firmTenant?.id ?? tenant.id, "/dashboard", intuitSub);
    }

    // New connection — classify firm vs client
    return buildResponse(req, userId, firmId, tenant.id, `/connect-type?tenantId=${tenant.id}`, intuitSub);

  } catch (err) {
    console.error("QBO/SSO callback error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
}

// ─── Stripe reconnect helper ──────────────────────────────────────────────────

async function handleStripeReconnect(
  db: ReturnType<typeof getServiceSupabase>,
  firmId: string
): Promise<void> {
  try {
    const { data: firm } = await db.from("firms").select("stripe_subscription_id").eq("id", firmId).single();
    if (!firm?.stripe_subscription_id) return;

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
    if (archiveItem) {
      if ((archiveItem.quantity ?? 1) > 1) {
        items.push({ id: archiveItem.id, quantity: (archiveItem.quantity ?? 1) - 1 });
      } else {
        items.push({ id: archiveItem.id, deleted: true });
      }
    }
    if (items.length > 0) {
      await stripe.subscriptions.update(firm.stripe_subscription_id, { items } as Parameters<typeof stripe.subscriptions.update>[1]);
    }
  } catch (e) {
    console.error("Stripe reconnect update failed:", e);
  }
}
