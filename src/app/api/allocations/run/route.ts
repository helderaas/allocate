import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchGLBalances, fetchRevenueSplit, Division, QBOAuthExpiredError } from "@/lib/qbo-client";
import { calculateAllocationLines } from "@/lib/allocation-engine";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period, startDate, endDate, jeDate, description, journalNumber } = await req.json();

  const db = getServiceSupabase();

  const { data: tenant } = await db
    .from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { data: rules } = await db
    .from("allocation_rules").select("*").eq("tenant_id", tenantId);
  if (!rules?.length) return NextResponse.json({ error: "No rules configured" }, { status: 400 });

  // Load divisions from new table, fall back to legacy A/B
  const { data: divisionRows } = await db
    .from("divisions").select("*").eq("tenant_id", tenantId).order("sort_order");

  let divisions: Division[];
  if (divisionRows && divisionRows.length > 0) {
    divisions = divisionRows.map(d => ({
      id: d.id,
      name: d.name,
      qbo_location_id: d.qbo_location_id,
      qbo_class_id: d.qbo_class_id,
    }));
  } else {
    // Legacy fallback — create two virtual divisions from tenant A/B
    divisions = [
      { id: "div-a", name: tenant.division_a_location_name ?? "Division A", qbo_location_id: tenant.division_a_location_id },
      { id: "div-b", name: tenant.division_b_location_name ?? "Division B", qbo_location_id: tenant.division_b_location_id },
    ];
  }

  const trackingType = tenant.division_tracking_type ?? "location";
  const accountIds = rules.map((r: { qbo_account_id: string }) => r.qbo_account_id);

  let glBalances, revenueSplit;
  try {
    [glBalances, revenueSplit] = await Promise.all([
      fetchGLBalances(
        tenant.id, tenant.qbo_realm_id,
        tenant.qbo_access_token, tenant.qbo_refresh_token,
        startDate, endDate, accountIds, divisions, trackingType
      ),
      fetchRevenueSplit(
        tenant.id, tenant.qbo_realm_id,
        tenant.qbo_access_token, tenant.qbo_refresh_token,
        startDate, endDate, divisions, trackingType
      ),
    ]);
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "Your QuickBooks connection has expired. Please reconnect QBO from the dashboard.", qbo_reconnect_required: true }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch QBO data: ${msg}` }, { status: 500 });
  }

  const lines = calculateAllocationLines(rules, glBalances, revenueSplit, divisions);

  const totalDebits = lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.untagged_amount, 0);

  await db.from("allocation_drafts").delete()
    .eq("tenant_id", tenantId)
    .eq("period", period)
    .in("status", ["draft", "voided"]);

  const { data: draft, error } = await db
    .from("allocation_drafts")
    .insert({
      tenant_id: tenantId,
      period,
      status: "draft",
      lines: JSON.stringify(lines),
      total_debits: totalDebits,
      total_credits: totalCredits,
      je_date: jeDate,
      description,
      journal_number: journalNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft });
}
