import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  const userId = req.cookies.get("user_id")?.value
    ?? req.cookies.get("sb_access_token")?.value; // fallback for any existing sessions

  if (!firmId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();

  // Get firm and count active tenants
  const { data: firm } = await db
    .from("firms")
    .select("*, tenants(id, is_firm_company), stripe_subscription_id, stripe_customer_id")
    .eq("id", firmId)
    .single();

  if (!firm) return NextResponse.json({ error: "Firm not found" }, { status: 404 });

  // Get user email — try intuit_users first (SSO), fall back to Supabase auth
  let userEmail: string | undefined;
  const { data: intuitUser } = await db
    .from("intuit_users")
    .select("email")
    .eq("user_id", userId)
    .single();

  if (intuitUser?.email) {
    userEmail = intuitUser.email;
  } else {
    // Try looking up by firm_id as fallback
    const { data: firmIntuitUser } = await db.from("intuit_users").select("email").eq("firm_id", firmId).single();
    if (firmIntuitUser?.email) {
      userEmail = firmIntuitUser.email;
    } else {
      try {
        const { data: { user } } = await db.auth.admin.getUserById(userId);
        userEmail = user?.email;
      } catch { /* non-fatal */ }
    }
  }

  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Count all connected companies (firm + clients) — all billed at $17/month
  const quantity = Math.max(1, (firm.tenants ?? []).length);

  // If already subscribed, update the subscription quantity and return to dashboard
  if (firm.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(firm.stripe_subscription_id);
      const item = sub.items.data.find(i => i.price.id === process.env.STRIPE_PRICE_ID);
      if (item) {
        await stripe.subscriptions.update(firm.stripe_subscription_id, {
          items: [{ id: item.id, quantity }],
          proration_behavior: "always_invoice",
        });
        await db.from("firms").update({ subscription_quantity: quantity }).eq("id", firmId);
      }
    } catch (e) {
      console.error("Failed to update subscription quantity:", e);
    }
    return NextResponse.json({ url: null }); // null = go to dashboard
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.allocateapp.net";

  // Create or retrieve Stripe customer
  let customerId = firm.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { firm_id: firmId },
    });
    customerId = customer.id;
    await db.from("firms").update({ stripe_customer_id: customerId }).eq("id", firmId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{
      price: process.env.STRIPE_PRICE_ID!,
      quantity,
    }],
    success_url: siteUrl + "/api/stripe/restore?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: `${siteUrl}/subscription/cancel`,
    metadata: { firm_id: firmId },
    subscription_data: {
      metadata: { firm_id: firmId },
      trial_period_days: 14,
    },
  });

  return NextResponse.json({ url: session.url });
}
