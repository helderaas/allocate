import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError, Division } from "@/lib/qbo-client";

interface TxnRow {
  ColData?: { value: string; id?: string }[];
  type?: string;
  Rows?: { Row?: TxnRow[] };
}

function parseTransactionList(rows: TxnRow[], vendorName: string): Record<string, { accountName: string; total: number }> {
  const map: Record<string, { accountName: string; total: number }> = {};
  for (const row of rows) {
    if (row.type === "Data" && row.ColData) {
      const cols = row.ColData;
      const rowVendor = cols[3]?.value ?? "";
      if (rowVendor.toLowerCase() !== vendorName.toLowerCase()) continue;
      const accountName = cols[5]?.value ?? "";
      const accountId = cols[5]?.id ?? accountName;
      const amount = Math.abs(parseFloat(cols[7]?.value ?? "0") || 0);
      if (accountName && amount > 0) {
        if (!map[accountId]) map[accountId] = { accountName, total: 0 };
        map[accountId].total += amount;
      }
    }
    if (row.Rows?.Row?.length) {
      const nested = parseTransactionList(row.Rows.Row, vendorName);
      for (const [id, d] of Object.entries(nested)) {
        if (!map[id]) map[id] = { accountName: d.accountName, total: 0 };
        map[id].total += d.total;
      }
    }
  }
  return map;
}

function round2(n: number) { return Math.round(n * 100) / 100; }

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    vendorId, vendorName,
    period, startDate, endDate, jeDate, description, journalNumber,
    splitMap, // Record<divisionId, pct>
  } = await req.json();

  if (!vendorId || !startDate || !endDate || !splitMap) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { data: divisionRows } = await db
    .from("divisions").select("*").eq("tenant_id", tenantId).order("sort_order");

  const divisions: Division[] = (divisionRows ?? []).map(d => ({
    id: d.id, name: d.name,
    qbo_location_id: d.qbo_location_id,
    qbo_class_id: d.qbo_class_id,
  }));

  const trackingType: "location" | "class" = tenant.division_tracking_type ?? "location";

  // Fetch vendor transactions
  let txnData: { Rows: { Row: TxnRow[] } };
  try {
    // QBO TransactionList does not support vendor filtering via params — fetch all and filter client-side
    txnData = await qboRequest<{ Rows: { Row: TxnRow[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/reports/TransactionList",
      { start_date: startDate, end_date: endDate, accounting_method: "Accrual" }
    );
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "QBO session expired. Please reconnect.", qbo_reconnect_required: true }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch vendor transactions" }, { status: 500 });
  }

  const accountTotals = parseTransactionList(txnData?.Rows?.Row ?? [], vendorName);
  const accounts = Object.entries(accountTotals)
    .map(([id, { accountName, total }]) => ({ id, accountName, total: round2(total) }))
    .filter(a => a.total > 0);

  if (accounts.length === 0) {
    return NextResponse.json({ error: `No transactions found for ${vendorName} in this period.` }, { status: 400 });
  }

  // Build allocation lines — one per account
  const lines = accounts.map(acct => {
    const divisionAmounts: Record<string, number> = {};
    divisions.forEach(div => {
      const pct = splitMap[div.id] ?? 0;
      divisionAmounts[div.id] = round2(acct.total * (pct / 100));
    });

    // Legacy 2-div fields for review screen compatibility
    const divAAmount = divisionAmounts[divisions[0]?.id] ?? 0;
    const divBAmount = divisionAmounts[divisions[1]?.id] ?? 0;

    return {
      account_id: acct.id,
      account_name: acct.accountName,
      account_type: "Expense", // vendor transactions are expenses
      rule_type: "fixed_split" as const,
      vendor_name: vendorName,
      total_amount: acct.total,
      untagged_amount: acct.total,
      already_tagged_a: 0,
      already_tagged_b: 0,
      division_a_amount: divAAmount,
      division_b_amount: divBAmount,
      division_amounts: divisionAmounts,
      division_a_pct: splitMap[divisions[0]?.id] ?? 0,
      division_b_pct: splitMap[divisions[1]?.id] ?? 0,
    };
  });

  const totalDebits = lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.untagged_amount, 0);
  const periodKey = period ?? startDate.slice(0, 7);

  // Clear any existing vendor draft for this period + vendor
  await db.from("allocation_drafts").delete()
    .eq("tenant_id", tenantId)
    .eq("period", periodKey)
    .eq("allocation_type", "vendor")
    .in("status", ["draft", "voided"]);

  const jeDescription = description || `Vendor allocation - ${vendorName} - ${new Date(startDate + "T12:00:00").toLocaleString("default", { month: "long", year: "numeric" })}`;

  const { data: draft, error } = await db.from("allocation_drafts").insert({
    tenant_id: tenantId,
    period: periodKey,
    status: "draft",
    allocation_type: "vendor",
    vendor_id: vendorId,
    vendor_name: vendorName,
    lines: JSON.stringify(lines),
    total_debits: round2(totalDebits),
    total_credits: round2(totalCredits),
    je_date: jeDate || endDate,
    description: jeDescription,
    journal_number: journalNumber,
  }).select().single();

  if (error) {
    console.error("Draft insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft });
}
