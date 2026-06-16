import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError, Division } from "@/lib/qbo-client";

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

function extractTxnRefs(rows: TxnRow[], vendorName: string): { id: string; type: string }[] {
  const refs: { id: string; type: string }[] = [];
  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      if ((cols[4]?.value ?? "").toLowerCase() === vendorName.toLowerCase()) {
        const txnId = cols[1]?.id;
        const txnType = cols[1]?.value;
        if (txnId && txnType) refs.push({ id: txnId, type: txnType });
      }
    }
    if (row.Rows?.Row?.length) refs.push(...extractTxnRefs(row.Rows.Row, vendorName));
  }
  const seen = new Set<string>();
  return refs.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

function extractLines(txn: { Line?: QBOLine[] }): Record<string, { accountName: string; total: number }> {
  const map: Record<string, { accountName: string; total: number }> = {};
  for (const line of txn.Line ?? []) {
    if (line.DetailType === "AccountBasedExpenseLineDetail") {
      const ref = line.AccountBasedExpenseLineDetail?.AccountRef;
      const amount = line.Amount ?? 0;
      if (ref && amount > 0) {
        if (!map[ref.value]) map[ref.value] = { accountName: ref.name, total: 0 };
        map[ref.value].total += amount;
      }
    }
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

const TXN_TYPE_MAP: Record<string, string> = {
  "Check": "purchase",
  "Expense": "purchase",
  "Credit Card Credit": "purchase",
  "Cash Expense": "purchase",
  "Bill": "bill",
  "Journal Entry": "journalentry",
  "Vendor Credit": "vendorcredit",
};

function round2(n: number) { return Math.round(n * 100) / 100; }

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendorId, vendorName, period, startDate, endDate, jeDate, description, journalNumber, splitMap } = await req.json();

  if (!vendorId || !vendorName || !startDate || !endDate || !splitMap) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { data: divisionRows } = await db.from("divisions").select("*").eq("tenant_id", tenantId).order("sort_order");
  const divisions: Division[] = (divisionRows ?? []).map(d => ({
    id: d.id, name: d.name,
    qbo_location_id: d.qbo_location_id,
    qbo_class_id: d.qbo_class_id,
  }));

  try {
    // Step 1: Get transaction IDs from TransactionList
    const txnListData = await qboRequest<{ Rows: { Row: TxnRow[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      { start_date: startDate, end_date: endDate, accounting_method: "Accrual" }
    );

    const txnRefs = extractTxnRefs(txnListData?.Rows?.Row ?? [], vendorName);
    if (txnRefs.length === 0) {
      return NextResponse.json({ error: `No transactions found for ${vendorName} in this period.` }, { status: 400 });
    }

    // Step 2: Fetch each transaction and extract line items
    const accountMap: Record<string, { accountName: string; total: number }> = {};
    await Promise.all(txnRefs.map(async ({ id, type }) => {
      const entity = TXN_TYPE_MAP[type];
      if (!entity) return;
      try {
        const txn = await qboRequest<Record<string, { Line?: QBOLine[] }>>(
          tenant.id, tenant.qbo_realm_id,
          tenant.qbo_access_token, tenant.qbo_refresh_token,
          `/${entity}/${id}`
        );
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
      .map(([id, { accountName, total }]) => ({ id, accountName, total: round2(total) }))
      .filter(a => a.total > 0);

    if (accounts.length === 0) {
      return NextResponse.json({ error: `No expense lines found for ${vendorName} in this period.` }, { status: 400 });
    }

    // Build allocation lines
    const lines = accounts.map(acct => {
      const divisionAmounts: Record<string, number> = {};
      divisions.forEach(div => {
        divisionAmounts[div.id] = round2(acct.total * ((splitMap[div.id] ?? 0) / 100));
      });
      return {
        account_id: acct.id,
        account_name: acct.accountName,
        account_type: "Expense",
        rule_type: "fixed_split" as const,
        vendor_name: vendorName,
        total_amount: acct.total,
        untagged_amount: acct.total,
        already_tagged_a: 0,
        already_tagged_b: 0,
        division_a_amount: divisionAmounts[divisions[0]?.id] ?? 0,
        division_b_amount: divisionAmounts[divisions[1]?.id] ?? 0,
        division_amounts: divisionAmounts,
        division_a_pct: splitMap[divisions[0]?.id] ?? 0,
        division_b_pct: splitMap[divisions[1]?.id] ?? 0,
      };
    });

    const totalDebits = round2(lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0));
    const totalCredits = round2(lines.reduce((sum, l) => sum + l.untagged_amount, 0));
    const periodKey = period ?? startDate.slice(0, 7);
    const jeDescription = description || `Vendor allocation - ${vendorName} - ${new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })}`;

    await db.from("allocation_drafts").delete()
      .eq("tenant_id", tenantId).eq("period", periodKey).eq("allocation_type", "vendor").in("status", ["draft", "voided"]);

    const { data: draft, error } = await db.from("allocation_drafts").insert({
      tenant_id: tenantId, period: periodKey, status: "draft",
      allocation_type: "vendor", vendor_id: vendorId, vendor_name: vendorName,
      lines: JSON.stringify(lines), total_debits: totalDebits, total_credits: totalCredits,
      je_date: jeDate || endDate, description: jeDescription, journal_number: journalNumber,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ draft });

  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "QBO session expired. Please reconnect.", qbo_reconnect_required: true }, { status: 401 });
    }
    console.error("run-vendor error:", err);
    return NextResponse.json({ error: "Failed to run vendor allocation" }, { status: 500 });
  }
}
