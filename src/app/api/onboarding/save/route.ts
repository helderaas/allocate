import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { divisionAId, divisionBId, divisionAName, divisionBName, rules } = await req.json();
  const db = getServiceSupabase();

  await db.from("tenants").update({
    division_a_location_id: divisionAId,
    division_a_location_name: divisionAName,
    division_b_location_id: divisionBId,
    division_b_location_name: divisionBName,
  }).eq("id", tenantId);

  if (rules?.length) {
    // Delete ALL existing rules for this tenant first, then insert fresh
    await db.from("allocation_rules").delete().eq("tenant_id", tenantId);

    const rows = rules.map((r: { qbo_account_id: string; qbo_account_name: string; rule_type: string; fixed_pct_division_a: number }) => ({
      tenant_id: tenantId,
      qbo_account_id: r.qbo_account_id,
      qbo_account_name: r.qbo_account_name,
      rule_type: r.rule_type,
      fixed_pct_division_a: r.rule_type === "fixed_split" ? r.fixed_pct_division_a : null,
    }));
    await db.from("allocation_rules").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
// v2
