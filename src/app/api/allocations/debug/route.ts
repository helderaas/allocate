import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest } from "@/lib/qbo-client";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { startDate, endDate } = await req.json();

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

  // Fetch raw trial balance
  const trialBalanceRaw = await qboRequest<unknown>(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token,
    "/reports/TrialBalance",
    { start_date: startDate, end_date: endDate, accounting_method: "Accrual" }
  );

  // Fetch raw P&L for division A
  const plARaw = await qboRequest<unknown>(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token,
    "/reports/ProfitAndLoss",
    {
      start_date: startDate,
      end_date: endDate,
      accounting_method: "Accrual",
      department: tenant.division_a_location_id,
    }
  );

  // Fetch raw P&L for division B
  const plBRaw = await qboRequest<unknown>(
    tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token,
    "/reports/ProfitAndLoss",
    {
      start_date: startDate,
      end_date: endDate,
      accounting_method: "Accrual",
      department: tenant.division_b_location_id,
    }
  );

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      qbo_realm_id: tenant.qbo_realm_id,
      division_a_location_id: tenant.division_a_location_id,
      division_b_location_id: tenant.division_b_location_id,
    },
    configuredRules: (rules ?? []).map((r: { qbo_account_id: string; qbo_account_name: string; rule_type: string }) => ({
      account_id: r.qbo_account_id,
      account_name: r.qbo_account_name,
      rule_type: r.rule_type,
    })),
    trialBalanceRaw,
    plARaw,
    plBRaw,
  });
}
