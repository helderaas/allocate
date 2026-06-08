import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = getServiceSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        metadata?: { firm_id?: string };
        subscription?: string;
      };
      const firmId = session.metadata?.firm_id;
      if (!firmId || !session.subscription) break;

      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await db.from("firms").update({
        stripe_subscription_id: sub.id,
        subscription_status: "active",
        subscription_quantity: sub.items.data[0]?.quantity ?? 1,
        subscription_current_period_end: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
      }).eq("id", firmId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as {
        id: string;
        status: string;
        metadata?: { firm_id?: string };
        items: { data: { quantity?: number }[] };
        current_period_end: number;
      };
      const firmId = sub.metadata?.firm_id;
      if (!firmId) break;

      await db.from("firms").update({
        subscription_status: sub.status === "active" ? "active" : sub.status,
        subscription_quantity: sub.items.data[0]?.quantity ?? 1,
        subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }).eq("id", firmId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as {
        metadata?: { firm_id?: string };
      };
      const firmId = sub.metadata?.firm_id;
      if (!firmId) break;

      await db.from("firms").update({
        subscription_status: "canceled",
        subscription_quantity: 0,
      }).eq("id", firmId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as { customer?: string };
      const customerId = invoice.customer;
      if (!customerId) break;

      await db.from("firms").update({
        subscription_status: "past_due",
      }).eq("stripe_customer_id", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
