import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchGLBalances, fetchRevenueSplit } from "@/lib/qbo-client";
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

  const accountIds = rules.map((r: { qbo_account_id: string }) => r.qbo_account_id);

  // Fetch GL breakdowns (total / tagged A / tagged B / untagged) and revenue split in parallel
  const [glBalances, revenueSplit] = await Promise.all([
    fetchGLBalances(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate,
      accountIds,
      tenant.division_a_location_id,
      tenant.division_b_location_id
    ),
    fetchRevenueSplit(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate,
      tenant.division_a_location_id,
      tenant.division_b_location_id
    ),
  ]);

  const lines = calculateAllocationLines(rules, glBalances, revenueSplit);

  // Total debits = sum of both division amounts per line
  // Total credits = sum of untagged amounts (the offsetting credit with no department)
  const totalDebits = lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.untagged_amount, 0);

  // Only delete existing drafts — never touch posted or voided entries
  await db.from("allocation_drafts").delete()
    .eq("tenant_id", tenantId)
    .eq("period", period)
    .eq("status", "draft");

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

