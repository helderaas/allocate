import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();

  const { data: tenant } = await db
    .from("tenants")
    .select("division_a_location_id, division_a_location_name, division_b_location_id, division_b_location_name")
    .eq("id", tenantId)
    .single();

  const { data: rules } = await db
    .from("allocation_rules")
    .select("qbo_account_id, qbo_account_name, rule_type, fixed_pct_division_a, fixed_pct_map, account_type")
    .eq("tenant_id", tenantId)
    .order("qbo_account_name", { ascending: true });

  return NextResponse.json({ tenant, rules: rules ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
