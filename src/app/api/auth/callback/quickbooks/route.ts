import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";
import { QBOTokens } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state") ?? "";

  // Check if this is a reconnect for an existing tenant
  const isReconnect = state.startsWith("reconnect_");
  const reconnectTenantId = isReconnect ? state.replace("reconnect_", "") : null;

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_params", req.url));
  }

  try {
    const accessToken = req.cookies.get("sb_access_token")?.value;
    const firmId = req.cookies.get("firm_id")?.value;

    if (!accessToken) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const db = getServiceSupabase();

    const { data: { user } } = await db.auth.getUser(accessToken);
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    let currentFirmId = firmId;
    if (!currentFirmId) {
      const { data: firm } = await db
        .from("firms").select("id").eq("owner_user_id", user.id).single();
      currentFirmId = firm?.id;
    }

    if (!currentFirmId) {
      const { data: newFirm } = await db
        .from("firms")
        .insert({ name: user.email ?? "My Account", owner_user_id: user.id })
        .select("id").single();
      currentFirmId = newFirm?.id;
    }

    // Exchange code for QBO tokens
    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString("base64");

    const { data: tokens } = await axios.post<QBOTokens>(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QBO_REDIRECT_URI!,
      }).toString(),
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Fetch company name from QBO
    let companyInfo = null;
    try {
      companyInfo = await fetchCompanyInfo(
        "temp", realmId, tokens.access_token, tokens.refresh_token
      );
    } catch (e) {
      console.error("fetchCompanyInfo failed (non-fatal):", e);
    }

    // Upsert tenant with company name
    const upsertData: Record<string, unknown> = {
      qbo_realm_id: realmId,
      user_id: user.id,
      firm_id: currentFirmId,
      company_name: companyInfo?.CompanyName ?? null,
      qbo_access_token: tokens.access_token,
      qbo_refresh_token: tokens.refresh_token,
      qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      qbo_connected: true,
    };

    // If reconnecting a specific tenant, update by ID instead of upsert by realm
    let tenant, error;
    if (reconnectTenantId) {
      const result = await db.from("tenants").update(upsertData).eq("id", reconnectTenantId).select().single();
      tenant = result.data; error = result.error;

      // Stripe: swap archive → active
      const { data: firm } = await db.from("firms").select("stripe_subscription_id").eq("id", currentFirmId!).single();
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
      tenant = result.data; error = result.error;
    }

    if (error) throw error;

    // Check for completed setup using new divisions table OR legacy A/B columns
    const { data: divisionsCheck } = await db
      .from("divisions").select("id").eq("tenant_id", tenant.id).limit(1);

    const { data: rules } = await db
      .from("allocation_rules").select("id").eq("tenant_id", tenant.id).limit(1);

    const hasDivisions = (divisionsCheck?.length ?? 0) > 0 ||
      (!!tenant.division_a_location_id && !!tenant.division_b_location_id);
    const hasRules = (rules?.length ?? 0) > 0;
    const isSetupComplete = hasDivisions && hasRules;

    const redirectPath = isSetupComplete ? "/dashboard" : "/new-allocation";

    const response = NextResponse.redirect(new URL(redirectPath, req.url));
    response.cookies.set("tenant_id", tenant.id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    if (currentFirmId) {
      response.cookies.set("firm_id", currentFirmId, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
      });
    }
    return response;
  } catch (err) {
    console.error("QBO OAuth callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?error=qbo_auth_failed", req.url));
  }
}
