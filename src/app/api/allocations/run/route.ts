import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchRevenueByLocation, fetchAccounts } from "@/lib/qbo-client";
import { calculateAllocationLines } from "@/lib/allocation-engine";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period, startDate, endDate } = await req.json();

  const db = getServiceSupabase();

  // Get tenant
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Get allocation rules
  const { data: rules } = await db
    .from("allocation_rules")
    .select("*")
    .eq("tenant_id", tenantId);
  if (!rules?.length) return NextResponse.json({ error: "No rules configured" }, { status: 400 });

  // Fetch revenue by location from QBO
  const revenueData = await fetchRevenueByLocation(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token,
    startDate, endDate
  );

  // Fetch account balances from QBO
  const accounts = await fetchAccounts(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token
  );

  // Build account balances map
  const accountBalances: Record<string, number> = {};
  for (const account of accounts) {
    accountBalances[account.Id] = 0;
  }

  // Calculate division percentages
  const divARevenue = revenueData[tenant.division_a_location_id] ?? 0;
  const divBRevenue = revenueData[tenant.division_b_location_id] ?? 0;
  const totalRevenue = divARevenue + divBRevenue;
  const divAPct = totalRevenue > 0 ? (divARevenue / totalRevenue) * 100 : 50;
  const divBPct = 100 - divAPct;

  // Calculate allocation lines
  const lines = calculateAllocationLines(rules, accountBalances, {
    divisionAPct: divAPct,
    divisionBPct: divBPct,
  });

  const totalDebits = lines.reduce((sum, l) => sum + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.division_a_amount, 0);

  // Save draft
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