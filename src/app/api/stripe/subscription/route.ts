import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ subscription: null });

  const db = getServiceSupabase();

  const { data: firm } = await db
    .from("firms")
    .select("subscription_status, subscription_quantity, subscription_current_period_end, stripe_customer_id, stripe_subscription_id")
    .eq("id", firmId)
    .single();

  // If DB shows inactive but we have a subscription ID, verify with Stripe directly
  if (firm?.stripe_subscription_id && 
      (firm.subscription_status === "inactive" || !firm.subscription_status)) {
    try {
      const sub = await stripe.subscriptions.retrieve(firm.stripe_subscription_id);
      if (sub.status === "trialing" || sub.status === "active") {
        // Update DB with correct status
        await db.from("firms").update({
          subscription_status: sub.status,
          stripe_customer_id: sub.customer as string,
          subscription_quantity: sub.items.data[0]?.quantity ?? 1,
        }).eq("id", firmId);
        
        // Check for client tenants
        const { data: clientTenants } = await db
          .from("tenants")
          .select("id")
          .eq("firm_id", firmId)
          .eq("is_firm_company", false)
          .eq("qbo_connected", true)
          .limit(1);

        return NextResponse.json({
          subscription: {
            subscription_status: sub.status,
            subscription_quantity: sub.items.data[0]?.quantity ?? 1,
            stripe_customer_id: sub.customer,
            is_firm_only: (clientTenants?.length ?? 0) === 0,
          }
        });
      }
    } catch (e) {
      console.error("Stripe subscription verify failed:", e);
    }
  }

  // Check for client tenants
  const { data: clientTenants } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_firm_company", false)
    .eq("qbo_connected", true)
    .limit(1);

  const hasClients = (clientTenants?.length ?? 0) > 0;

  if (firm?.subscription_status === "active" || firm?.subscription_status === "trialing") {
    return NextResponse.json({
      subscription: {
        ...firm,
        is_firm_only: !hasClients,
      }
    });
  }

  return NextResponse.json({ subscription: firm ?? null });
}
