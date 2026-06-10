import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

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
    .select("*, tenants(id), stripe_subscription_id, stripe_customer_id")
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
    // Legacy Supabase session fallback
    try {
      const { data: { user } } = await db.auth.admin.getUserById(userId);
      userEmail = user?.email;
    } catch { /* non-fatal */ }
  }

  if (!userEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If already subscribed, redirect to billing portal instead of new checkout
  if (firm.stripe_subscription_id) {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: firm.stripe_customer_id!,
      return_url: ,
    });
    return NextResponse.json({ url: portalSession.url });
  }

  const quantity = Math.max(1, firm.tenants?.length ?? 1);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://allocateapp.net";

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
    success_url: `${siteUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/subscription/cancel`,
    metadata: { firm_id: firmId },
    subscription_data: {
      metadata: { firm_id: firmId },
      trial_period_days: 14,
    },
  });

  return NextResponse.json({ url: session.url });
}
