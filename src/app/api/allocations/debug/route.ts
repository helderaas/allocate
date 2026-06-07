import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchTrialBalance, fetchRevenueSplit } from "@/lib/qbo-client";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { startDate, endDate } = await req.json();

  const db = getServiceSupabase();
  const { data: tenant } = await db
    .from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { data: rules } = await db
    .from("allocation_rules").select("*").eq("tenant_id", tenantId);

  const [accountBalances, revenueSplit] = await Promise.all([
    fetchTrialBalance(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate
    ),
    fetchRevenueSplit(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate,
      tenant.division_a_location_id,
      tenant.division_b_location_id
    ),
  ]);

  // Show every account that came back from the trial balance
  const allParsedAccounts = Object.entries(accountBalances).map(([id, balance]) => ({
    id, balance
  }));

  // Show which configured rules matched vs missed
  const ruleMatches = (rules ?? []).map((r: { qbo_account_id: string; qbo_account_name: string; rule_type: string }) => ({
    account_id: r.qbo_account_id,
    account_name: r.qbo_account_name,
    rule_type: r.rule_type,
    balance_found: accountBalances[r.qbo_account_id] ?? "NOT IN TRIAL BALANCE",
  }));

  return NextResponse.json({
    period: { startDate, endDate },
    revenueSplit,
    totalAccountsInTrialBalance: allParsedAccounts.length,
    allParsedAccounts,
    configuredRuleMatches: ruleMatches,
  });
}
