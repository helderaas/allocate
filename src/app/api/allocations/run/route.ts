import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchAccounts } from "@/lib/qbo-client";
import { calculateAllocationLines } from "@/lib/allocation-engine";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period, startDate, endDate, jeDate, description, journalNumber } = await req.json();

  const db = getServiceSupabase();

  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { data: rules } = await db
    .from("allocation_rules")
    .select("*")
    .eq("tenant_id", tenantId);
  if (!rules?.length) return NextResponse.json({ error: "No rules configured" }, { status: 400 });

  const accounts = await fetchAccounts(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token
  );

  const accountBalances: Record<string, number> = {};
  for (const account of accounts) {
    accountBalances[account.Id] = 0;
  }

  const divAPct = 50;
  const divBPct = 50;

  const lines = calculateAllocationLines(rules, accountBalances, {
    divisionAPct: divAPct,
    divisionBPct: divBPct,
  });

  const totalDebits = lines.reduce((sum, l) => sum + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.division_a_amount, 0);

  // Delete ALL existing drafts for this tenant+period regardless of status
  // so we never accumulate stale rows that confuse .single() on the GET
  await db.from("allocation_drafts").delete()
    .eq("tenant_id", tenantId)
    .eq("period", period);

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
      description: description,
      journal_number: journalNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ draft });
}
