import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "No tenant_id cookie" }, { status: 401 });

  const db = getServiceSupabase();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, qbo_realm_id, division_a_location_name, division_b_location_name")
    .eq("id", tenantId)
    .single();

  const { data: rules } = await db
    .from("allocation_rules")
    .select("qbo_account_id, qbo_account_name, rule_type, fixed_pct_division_a")
    .eq("tenant_id", tenantId);

  const { data: drafts } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ tenantId, tenant, rules, recentDrafts: drafts }, {
    headers: { "Cache-Control": "no-store" },
  });
}
