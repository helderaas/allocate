import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("user_id")?.value;
  const firmId = req.cookies.get("firm_id")?.value;
  if (!userId || !firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();

  try {
    // Get all tenants for this firm
    const { data: tenants } = await db.from("tenants").select("id").eq("firm_id", firmId);

    // Delete all tenant data
    for (const tenant of tenants ?? []) {
      await db.from("allocation_drafts").delete().eq("tenant_id", tenant.id);
      await db.from("allocation_rules").delete().eq("tenant_id", tenant.id);
      await db.from("allocation_templates").delete().eq("tenant_id", tenant.id);
      await db.from("divisions").delete().eq("tenant_id", tenant.id);
    }
    await db.from("tenants").delete().eq("firm_id", firmId);

    // Cancel Stripe subscription if one exists
    const { data: firm } = await db.from("firms").select("stripe_subscription_id").eq("id", firmId).single();
    if (firm?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(firm.stripe_subscription_id);
      } catch (e) {
        console.error("Stripe cancel failed (non-fatal):", e);
      }
    }

    // Delete intuit_users, firm, and auth user
    await db.from("intuit_users").delete().eq("firm_id", firmId);
    await db.from("firms").delete().eq("id", firmId);
    await db.auth.admin.deleteUser(userId);
  } catch (e) {
    console.error("Account delete error:", e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Clear all cookies
  const res = NextResponse.json({ ok: true });
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 0 };
  res.cookies.set("user_id", "", cookieOpts);
  res.cookies.set("sb_access_token", "", cookieOpts);
  res.cookies.set("firm_id", "", cookieOpts);
  res.cookies.set("tenant_id", "", cookieOpts);
  res.cookies.set("intuit_sub", "", cookieOpts);
  return res;
}
