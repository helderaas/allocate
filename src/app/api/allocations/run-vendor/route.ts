import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError, Division } from "@/lib/qbo-client";

interface QBOLine {
  Amount?: number;
  DetailType?: string;
  AccountBasedExpenseLineDetail?: {
    AccountRef?: { value: string; name: string };
  };
  JournalEntryLineDetail?: {
    AccountRef?: { value: string; name: string };
    PostingType?: string;
  };
}

interface QBOTransaction {
  Id: string;
  TxnDate: string;
  Line?: QBOLine[];
}

function extractExpenseLines(
  txns: QBOTransaction[]
): Record<string, { accountName: string; total: number }> {
  const map: Record<string, { accountName: string; total: number }> = {};
  for (const txn of txns) {
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
    splitMap,
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

  // Fetch Bills and Purchases (Checks/Expenses) for this vendor
  const allTxns: QBOTransaction[] = [];
  for (const entity of ["Bill", "Purchase"]) {
    let position = 1;
    const PAGE = 100;
    try {
      while (true) {
        const query = `SELECT * FROM ${entity} WHERE VendorRef = '${vendorId}' AND TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' STARTPOSITION ${position} MAXRESULTS ${PAGE}`;
        const data = await qboRequest<{ QueryResponse: Record<string, QBOTransaction[]> }>(
          tenant.id, tenant.qbo_realm_id,
          tenant.qbo_access_token, tenant.qbo_refresh_token,
          "/query", { query }
        );
        const page = data.QueryResponse?.[entity] ?? [];
        allTxns.push(...page);
        if (page.length < PAGE) break;
        position += PAGE;
      }
    } catch (err) {
      if (err instanceof QBOAuthExpiredError) throw err;
      console.error(`Error fetching ${entity}:`, err);
    }
  }

  const accountTotals = extractExpenseLines(allTxns);
  const accounts = Object.entries(accountTotals)
    .map(([id, { accountName, total }]) => ({ id, accountName, total: round2(total) }))
    .filter(a => a.total > 0);

  if (accounts.length === 0) {
    return NextResponse.json({ error: `No expense transactions found for ${vendorName} in this period.` }, { status: 400 });
  }

  // Build allocation lines — one per account
  const lines = accounts.map(acct => {
    const divisionAmounts: Record<string, number> = {};
    divisions.forEach(div => {
      const pct = splitMap[div.id] ?? 0;
      divisionAmounts[div.id] = round2(acct.total * (pct / 100));
    });

    const divAAmount = divisionAmounts[divisions[0]?.id] ?? 0;
    const divBAmount = divisionAmounts[divisions[1]?.id] ?? 0;

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
      division_a_amount: divAAmount,
      division_b_amount: divBAmount,
      division_amounts: divisionAmounts,
      division_a_pct: splitMap[divisions[0]?.id] ?? 0,
      division_b_pct: splitMap[divisions[1]?.id] ?? 0,
    };
  });

  const totalDebits = round2(lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0));
  const totalCredits = round2(lines.reduce((sum, l) => sum + l.untagged_amount, 0));
  const periodKey = period ?? startDate.slice(0, 7);

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
    total_debits: totalDebits,
    total_credits: totalCredits,
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
