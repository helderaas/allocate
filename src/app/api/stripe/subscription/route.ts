import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ subscription: null });

  const db = getServiceSupabase();

  const { data: firm } = await db
    .from("firms")
    .select("subscription_status, subscription_quantity, subscription_current_period_end, stripe_customer_id")
    .eq("id", firmId)
    .single();

  // Check for client tenants regardless of subscription status
  const { data: clientTenants } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_firm_company", false)
    .eq("qbo_connected", true)
    .limit(1);

  const hasClients = (clientTenants?.length ?? 0) > 0;

  // Active Stripe subscription — still check is_firm_only
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
