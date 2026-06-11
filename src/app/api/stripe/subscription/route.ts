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

  // Active Stripe subscription
  if (firm?.subscription_status === "active" || firm?.subscription_status === "trialing") {
    return NextResponse.json({ subscription: firm });
  }

  // Check for client tenants (paid connections)
  const { data: clientTenants } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_firm_company", false)
    .eq("qbo_connected", true)
    .limit(1);

  const hasClients = (clientTenants?.length ?? 0) > 0;

  // Check for firm company (free access)
  const { data: firmTenant } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firmId)
    .eq("is_firm_company", true)
    .eq("qbo_connected", true)
    .limit(1)
    .single();

  if (firmTenant) {
    return NextResponse.json({
      subscription: {
        subscription_status: "active",
        // Only show firm-only banner if no client companies connected
        is_firm_only: !hasClients,
      }
    });
  }

  return NextResponse.json({ subscription: firm ?? null });
}
