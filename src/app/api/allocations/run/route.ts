import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchAccounts } from "@/lib/qbo-client";
import { calculateAllocationLines } from "@/lib/allocation-engine";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period, startDate, endDate } = await req.json();

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

  // Use 50/50 as default revenue split until P&L parsing is working
  // This will be replaced with real revenue data in the next update
  const divAPct = 50;
  const divBPct = 50;

  const lines = calculateAllocationLines(rules, accountBalances, {
    divisionAPct: divAPct,
    divisionBPct: divBPct,
  });

  const totalDebits = lines.reduce((sum, l) => sum + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.division_a_amount, 0);

  const { data: draft, error } = await db
    .from("allocation_drafts")
    .upsert({
      tenant_id: tenantId,
      period,
      status: "draft",
      lines: JSON.stringify(lines),
      total_debits: totalDebits,
      total_credits: totalCredits,
    }, { onConflict: "tenant_id,period" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ draft });
}
