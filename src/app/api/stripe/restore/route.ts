import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";
import { safeDecrypt } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const firmId = session.metadata?.firm_id;

    if (!firmId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const db = getServiceSupabase();

    const { data: firm } = await db
      .from("firms")
      .select("owner_user_id, stripe_subscription_id")
      .eq("id", firmId)
      .single();

    if (!firm) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Immediately update subscription status so dashboard doesn't show UpgradeWall
    // while waiting for the webhook to fire
    if (session.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await db.from("firms").update({
          stripe_subscription_id: sub.id,
          stripe_customer_id: session.customer as string,
          subscription_status: sub.status,
          subscription_quantity: sub.items.data[0]?.quantity ?? 1,
          subscription_current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
        }).eq("id", firmId);
      } catch (e) {
        console.error("Failed to eagerly update subscription status:", e);
      }
    }

    // Get the most recent tenant for this firm
    const { data: tenant } = await db
      .from("tenants")
      .select("id, company_name, qbo_realm_id, qbo_access_token, qbo_refresh_token")
      .eq("firm_id", firmId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Fetch company name if missing — fire and forget, don't block redirect
    if (tenant && !tenant.company_name && tenant.qbo_access_token && tenant.qbo_realm_id) {
      fetchCompanyInfo(
        tenant.id,
        tenant.qbo_realm_id,
        tenant.qbo_access_token,
        safeDecrypt(tenant.qbo_refresh_token)
      ).then(info => {
        if (info?.CompanyName) {
          db.from("tenants").update({ company_name: info.CompanyName }).eq("id", tenant.id);
        }
      }).catch(() => { /* non-fatal */ });
    }

    const response = NextResponse.redirect(new URL("/dashboard", req.url));
    const isProd = process.env.NODE_ENV === "production";
    const cookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

    response.cookies.set("user_id", firm.owner_user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("sb_access_token", firm.owner_user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    response.cookies.set("firm_id", firmId, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });

    if (tenant) {
      response.cookies.set("tenant_id", tenant.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
    }

    return response;
  } catch (err) {
    console.error("Session restore error:", err);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
