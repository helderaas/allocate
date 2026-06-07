import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest } from "@/lib/qbo-client";

// Parse GL rows to extract total amount from Section summaries
function parseGLTotal(glData: unknown): number {
  const rows = (glData as { Report?: { Rows?: { Row?: unknown[] } } })?.Report?.Rows?.Row
    ?? (glData as { Rows?: { Row?: unknown[] } })?.Rows?.Row
    ?? [];

  let total = 0;
  for (const row of rows as { Summary?: { ColData?: { value: string }[] }; type?: string }[]) {
    if (row.type === "Section" && row.Summary?.ColData) {
      const val = parseFloat(row.Summary.ColData[6]?.value || "0") || 0;
      total += val;
    }
  }
  return total;
}

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

  const accountIds = (rules ?? []).map((r: { qbo_account_id: string }) => r.qbo_account_id).join(",");

  const baseParams = {
    start_date: startDate,
    end_date: endDate,
    account: accountIds,
    accounting_method: "Accrual",
  };

  // Fetch all three GL variants in parallel
  const [glTotal, glDivA, glDivB] = await Promise.all([
    qboRequest<unknown>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/GeneralLedger", baseParams
    ),
    qboRequest<unknown>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/GeneralLedger",
      { ...baseParams, department: tenant.division_a_location_id }
    ),
    qboRequest<unknown>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/GeneralLedger",
      { ...baseParams, department: tenant.division_b_location_id }
    ),
  ]);

  const totalAmount = parseGLTotal(glTotal);
  const divAAmount = parseGLTotal(glDivA);
  const divBAmount = parseGLTotal(glDivB);
  const untaggedAmount = totalAmount - divAAmount - divBAmount;

  return NextResponse.json({
    period: { startDate, endDate },
    accountsQueried: accountIds,
    divisions: {
      a: tenant.division_a_location_id,
      b: tenant.division_b_location_id,
    },
    // Parsed totals — the key question: does department filter work on GL?
    parsedTotals: {
      totalAmount,
      divAAmount,
      divBAmount,
      untaggedAmount,
    },
    // Raw responses so we can verify the department filter is working
    glTotalRows: (glTotal as { Rows?: unknown }).Rows,
    glDivARows: (glDivA as { Rows?: unknown }).Rows,
    glDivBRows: (glDivB as { Rows?: unknown }).Rows,
  });
}
