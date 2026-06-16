import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError } from "@/lib/qbo-client";

interface TxnRow {
  ColData?: { value: string; id?: string }[];
  type?: string;
  Rows?: { Row?: TxnRow[] };
}

interface QBOLine {
  Amount?: number;
  DetailType?: string;
  AccountBasedExpenseLineDetail?: { AccountRef?: { value: string; name: string } };
  JournalEntryLineDetail?: { AccountRef?: { value: string; name: string }; PostingType?: string };
}

// Step 1: Get transaction IDs + types from TransactionList filtered by vendor name (col 4)
function extractTxnRefs(rows: TxnRow[], vendorName: string): { id: string; type: string }[] {
  const refs: { id: string; type: string }[] = [];
  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      if ((cols[4]?.value ?? "").toLowerCase() === vendorName.toLowerCase()) {
        const txnId = cols[1]?.id;
        const txnType = cols[1]?.value; // e.g. "Check", "Bill", "Expense", "Journal Entry"
        if (txnId && txnType) refs.push({ id: txnId, type: txnType });
      }
    }
    if (row.Rows?.Row?.length) refs.push(...extractTxnRefs(row.Rows.Row, vendorName));
  }
  // Deduplicate by id
  const seen = new Set<string>();
  return refs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

// Step 2: Extract expense line items from a fetched transaction
function extractLines(txn: { Line?: QBOLine[] }): Record<string, { accountName: string; total: number }> {
  const map: Record<string, { accountName: string; total: number }> = {};
  for (const line of txn.Line ?? []) {
    // Account-based expense lines (Bills, Checks, Expenses)
    if (line.DetailType === "AccountBasedExpenseLineDetail") {
      const ref = line.AccountBasedExpenseLineDetail?.AccountRef;
      const amount = line.Amount ?? 0;
      if (ref && amount > 0) {
        if (!map[ref.value]) map[ref.value] = { accountName: ref.name, total: 0 };
        map[ref.value].total += amount;
      }
    }
    // Journal entry debit lines
    if (line.DetailType === "JournalEntryLineDetail") {
      const detail = line.JournalEntryLineDetail;
      const ref = detail?.AccountRef;
      const amount = line.Amount ?? 0;
      if (ref && amount > 0 && detail?.PostingType === "Debit") {
        if (!map[ref.value]) map[ref.value] = { accountName: ref.name, total: 0 };
        map[ref.value].total += amount;
      }
    }
  }
  return map;
}

// Map TransactionList type names to QBO API entity names
const TXN_TYPE_MAP: Record<string, string> = {
  "Check": "purchase",
  "Expense": "purchase",
  "Credit Card Credit": "purchase",
  "Cash Expense": "purchase",
  "Bill": "bill",
  "Journal Entry": "journalentry",
  "Vendor Credit": "vendorcredit",
};

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vendorName = searchParams.get("vendorName");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!vendorName || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    // Step 1: Get all transaction IDs for this vendor from TransactionList
    const txnListData = await qboRequest<{ Rows: { Row: TxnRow[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      { start_date: startDate, end_date: endDate, accounting_method: "Accrual" }
    );

    const txnRefs = extractTxnRefs(txnListData?.Rows?.Row ?? [], vendorName);
    console.log("Vendor txn refs:", JSON.stringify(txnRefs));

    if (txnRefs.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    // Step 2: Fetch each transaction individually and extract line items
    const accountMap: Record<string, { accountName: string; total: number }> = {};

    await Promise.all(txnRefs.map(async ({ id, type }) => {
      const entity = TXN_TYPE_MAP[type];
      if (!entity) { console.log("Unknown txn type:", type); return; }
      try {
        const txn = await qboRequest<Record<string, { Line?: QBOLine[] }>>(
          tenant.id, tenant.qbo_realm_id,
          tenant.qbo_access_token, tenant.qbo_refresh_token,
          `/${entity}/${id}`
        );
        // QBO wraps the entity: { Purchase: {...} } or { Bill: {...} }
        const entityKey = Object.keys(txn).find(k => k !== "time");
        const txnData = entityKey ? txn[entityKey] : null;
        if (!txnData) return;

        const lines = extractLines(txnData);
        for (const [acctId, { accountName, total }] of Object.entries(lines)) {
          if (!accountMap[acctId]) accountMap[acctId] = { accountName, total: 0 };
          accountMap[acctId].total += total;
        }
      } catch (e) {
        console.error(`Failed to fetch ${entity}/${id}:`, e instanceof Error ? e.message : e);
      }
    }));

    const accounts = Object.entries(accountMap)
      .map(([id, { accountName, total }]) => ({
        id,
        accountName,
        total: Math.round(total * 100) / 100,
      }))
      .filter(a => a.total > 0)
      .sort((a, b) => b.total - a.total);

    console.log("Final accounts:", JSON.stringify(accounts));
    return NextResponse.json({ accounts });
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "QBO session expired. Please reconnect.", qbo_reconnect_required: true }, { status: 401 });
    }
    console.error("vendor-transactions error:", err);
    return NextResponse.json({ error: "Failed to fetch vendor transactions" }, { status: 500 });
  }
}
