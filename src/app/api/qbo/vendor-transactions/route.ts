import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError } from "@/lib/qbo-client";

interface TxnRow {
  ColData?: { value: string; id?: string }[];
  type?: string;
  group?: string;
  Rows?: { Row?: TxnRow[] };
}

// Parse TransactionList report into { accountId -> { accountName, total } }
function parseTransactionList(rows: TxnRow[]): Record<string, { accountName: string; total: number }> {
  const accountMap: Record<string, { accountName: string; total: number }> = {};

  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      // TransactionList columns (0-indexed):
      // 0: Date, 1: Transaction Type, 2: Num, 3: Name, 4: Memo/Description,
      // 5: Account (name), 6: Split, 7: Amount
      const cols = row.ColData;
      const accountName = cols[5]?.value ?? "";
      const accountId = cols[5]?.id ?? accountName; // QBO sometimes puts id on ColData
      const amountStr = cols[7]?.value ?? cols[6]?.value ?? "0";
      const amount = Math.abs(parseFloat(amountStr) || 0);

      if (accountName && amount !== 0) {
        if (!accountMap[accountId]) {
          accountMap[accountId] = { accountName, total: 0 };
        }
        accountMap[accountId].total += amount;
      }
    }
    // Recurse into nested rows
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
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!vendorId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing vendorId, startDate, or endDate" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const data = await qboRequest<{ Rows: { Row: TxnRow[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      {
        start_date: startDate,
        end_date: endDate,
        vendor: vendorId,
        accounting_method: "Accrual",
      }
    );

    const rows = data?.Rows?.Row ?? [];
    const accountTotals = parseTransactionList(rows);

    // Convert to array, round totals, filter zero amounts
    const accounts = Object.entries(accountTotals)
      .map(([id, { accountName, total }]) => ({
        id,
        accountName,
        total: Math.round(total * 100) / 100,
      }))
      .filter(a => a.total > 0);

    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "QBO session expired. Please reconnect.", qbo_reconnect_required: true }, { status: 401 });
    }
    console.error("vendor-transactions error:", err);
    return NextResponse.json({ error: "Failed to fetch vendor transactions" }, { status: 500 });
  }
}
