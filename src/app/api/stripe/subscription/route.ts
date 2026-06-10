import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ subscription: null });

  const db = getServiceSupabase();

  const { data: firm } = await db
    .from("firms")
    .select("subscription_status, subscription_quantity, subscription_current_period_end, stripe_customer_id")
    .eq("id", firmId)
    .single();

  // If firm has an active Stripe subscription, return it
  if (firm?.subscription_status === "active" || firm?.subscription_status === "trialing") {
    return NextResponse.json({ subscription: firm });
  }

  // Check if firm has a connected firm company (free access)
  // Firm connections get dashboard access without a Stripe subscription
  const { data: firmTenant } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_firm_company", true)
    .eq("qbo_connected", true)
    .limit(1)
    .single();

  if (firmTenant) {
    // Grant access — firm connection is free
    return NextResponse.json({
      subscription: {
        subscription_status: "active",
        is_firm_only: true, // flag so dashboard can show "add a client" prompt
      }
    });
  }

  return NextResponse.json({ subscription: firm ?? null });
}
