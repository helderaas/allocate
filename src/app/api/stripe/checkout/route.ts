import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  const accessToken = req.cookies.get("sb_access_token")?.value;

  if (!firmId || !accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();

  // Get firm and count active tenants
  const { data: firm } = await db
    .from("firms")
    .select("*, tenants(id)")
    .eq("id", firmId)
    .single();

  if (!firm) return NextResponse.json({ error: "Firm not found" }, { status: 404 });

  // Get user email for Stripe customer
  const { data: { user } } = await db.auth.getUser(accessToken);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quantity = Math.max(1, firm.tenants?.length ?? 1);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://allocate-blond.vercel.app";

  // Create or retrieve Stripe customer
  let customerId = firm.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { firm_id: firmId },
    });
    customerId = customer.id;
    await db.from("firms").update({ stripe_customer_id: customerId }).eq("id", firmId);
  }

  // Create checkout session
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
    },
  });

  return NextResponse.json({ url: session.url });
}
