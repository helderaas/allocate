import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError } from "@/lib/qbo-client";

interface TxnRow {
  ColData?: { value: string; id?: string }[];
  type?: string;
  group?: string;
  Rows?: { Row?: TxnRow[] };
}

// TransactionList columns (0-indexed):
// 0: Date, 1: Transaction Type, 2: Num, 3: Name (vendor/customer), 4: Memo,
// 5: Account, 6: Split, 7: Amount
function parseTransactionList(
  rows: TxnRow[],
  vendorName: string
): Record<string, { accountName: string; total: number }> {
  const accountMap: Record<string, { accountName: string; total: number }> = {};

  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      const rowVendor = cols[4]?.value ?? "";
      // Filter to only rows matching our vendor (case-insensitive)
      if (rowVendor.toLowerCase() !== vendorName.toLowerCase()) continue;

      const accountName = cols[7]?.value ?? "";
      const accountId = cols[7]?.id ?? accountName;
      const amount = Math.abs(parseFloat(cols[9]?.value ?? "0") || 0);

      if (accountName && amount > 0) {
        if (!accountMap[accountId]) accountMap[accountId] = { accountName, total: 0 };
        accountMap[accountId].total += amount;
      }
    }
    if (row.Rows?.Row?.length) {
      const nested = parseTransactionList(row.Rows.Row, vendorName);
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
  const vendorName = searchParams.get("vendorName");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!vendorName || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing vendorName, startDate, or endDate" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    // Fetch full TransactionList — QBO does not support vendor filtering as a param,
    // so we filter client-side by matching the Name column to vendorName
    const data = await qboRequest<{ Rows: { Row: TxnRow[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      {
        start_date: startDate,
        end_date: endDate,
        accounting_method: "Accrual",
      }
    );

    const rows = data?.Rows?.Row ?? [];

    // Log all unique vendor names from col[4] so we can match exactly
    const allVendorNames = new Set<string>();
    const collectVendors = (r: TxnRow[]) => {
      for (const row of r) {
        if (row.type === "Data" && row.ColData) allVendorNames.add(row.ColData[4]?.value ?? "");
        if (row.Rows?.Row?.length) collectVendors(row.Rows.Row);
      }
    };
    collectVendors(rows);
    const vendorList = Array.from(allVendorNames).filter(Boolean).sort();
    console.log("Looking for vendor:", JSON.stringify(vendorName));
    console.log("Sample vendor names in report (first 20):", JSON.stringify(vendorList.slice(0, 20)));
    console.log("Exact match found:", vendorList.includes(vendorName));

    // Log the actual matched rows so we can see their column structure
    const matchedRows: TxnRow[] = [];
    const findMatched = (r: TxnRow[]) => {
      for (const row of r) {
        if (row.type === "Data" && row.ColData && row.ColData[4]?.value === vendorName) matchedRows.push(row);
        if (row.Rows?.Row?.length) findMatched(row.Rows.Row);
      }
    };
    findMatched(rows);
    console.log("Matched row count:", matchedRows.length);
    if (matchedRows.length > 0) console.log("First matched row ColData:", JSON.stringify(matchedRows[0].ColData));

    const accountTotals = parseTransactionList(rows, vendorName);
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
