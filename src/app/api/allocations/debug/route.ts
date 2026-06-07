import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest } from "@/lib/qbo-client";

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

  const accountIds = (rules ?? []).map((r: { qbo_account_id: string }) => r.qbo_account_id);

  // Fetch raw General Ledger for all configured accounts
  const glRaw = await qboRequest<unknown>(
    tenant.id, tenant.qbo_realm_id,
    tenant.qbo_access_token, tenant.qbo_refresh_token,
    "/reports/GeneralLedger",
    {
      start_date: startDate,
      end_date: endDate,
      account: accountIds.join(","),
      accounting_method: "Accrual",
    }
  );

  return NextResponse.json({
    period: { startDate, endDate },
    accountsQueried: accountIds,
    divisionALocationId: tenant.division_a_location_id,
    divisionBLocationId: tenant.division_b_location_id,
    glRaw,
  });
}
