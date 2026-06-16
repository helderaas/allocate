import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError } from "@/lib/qbo-client";

interface TxnRow {
  ColData?: { value: string; id?: string }[];
  type?: string;
  group?: string;
  Rows?: { Row?: TxnRow[] };
  Header?: unknown;
  Columns?: unknown;
}

function parseTransactionList(rows: TxnRow[]): Record<string, { accountName: string; total: number }> {
  const accountMap: Record<string, { accountName: string; total: number }> = {};

  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      // Log first row so we can see the column structure
      const accountName = cols[5]?.value ?? "";
      const accountId = cols[5]?.id ?? accountName;
      const amountStr = cols[7]?.value ?? cols[6]?.value ?? "0";
      const amount = Math.abs(parseFloat(amountStr) || 0);
      if (accountName && amount !== 0) {
        if (!accountMap[accountId]) accountMap[accountId] = { accountName, total: 0 };
        accountMap[accountId].total += amount;
      }
    }
    if (row.Rows?.Row?.length) {
      const nested = parseTransactionList(row.Rows.Row);
      for (const [id, data] of Object.entries(nested)) {
        if (!accountMap[id]) accountMap[id] = { accountName: data.accountName, total: 0 };
        accountMap[id].total += data.total;
      }
    }
  }
  return accountMap;
}

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get("vendorId");
  const vendorName = searchParams.get("vendorName");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!vendorId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing vendorId, startDate, or endDate" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    // QBO TransactionList: try both vendor name and vendor ID approaches
    // QBO expects "name" filter for vendor, not the internal ID in all versions
    const params: Record<string, string> = {
      start_date: startDate,
      end_date: endDate,
      accounting_method: "Accrual",
      source_account_type: "AP",
    };

    // Add vendor filter — QBO uses the display name as the filter value
    if (vendorName) {
      params.vendor = vendorName;
    }

    const data = await qboRequest<{ Rows: { Row: TxnRow[] }; Columns?: unknown; Header?: unknown }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      params
    );

    const rows = data?.Rows?.Row ?? [];
    console.log("TransactionList rows count:", rows.length);
    if (rows.length > 0) {
      console.log("First row sample:", JSON.stringify(rows[0]).slice(0, 500));
    }

    const accountTotals = parseTransactionList(rows);
    const accounts = Object.entries(accountTotals)
      .map(([id, { accountName, total }]) => ({
        id,
        accountName,
        total: Math.round(total * 100) / 100,
      }))
      .filter(a => a.total > 0);

    console.log("Parsed accounts:", JSON.stringify(accounts));
    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "QBO session expired. Please reconnect.", qbo_reconnect_required: true }, { status: 401 });
    }
    console.error("vendor-transactions error:", err);
    return NextResponse.json({ error: "Failed to fetch vendor transactions" }, { status: 500 });
  }
}
