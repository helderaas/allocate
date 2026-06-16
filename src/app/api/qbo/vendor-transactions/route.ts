import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, QBOAuthExpiredError } from "@/lib/qbo-client";

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
  TotalAmt?: number;
}

function extractExpenseLines(
  txns: QBOTransaction[]
): Record<string, { accountName: string; total: number }> {
  const accountMap: Record<string, { accountName: string; total: number }> = {};

  for (const txn of txns) {
    for (const line of txn.Line ?? []) {
      // Account-based expense lines (Bills, Checks, Expenses)
      if (line.DetailType === "AccountBasedExpenseLineDetail") {
        const ref = line.AccountBasedExpenseLineDetail?.AccountRef;
        const amount = line.Amount ?? 0;
        if (ref && amount > 0) {
          const id = ref.value;
          if (!accountMap[id]) accountMap[id] = { accountName: ref.name, total: 0 };
          accountMap[id].total += amount;
        }
      }
      // Journal entry debit lines
      if (line.DetailType === "JournalEntryLineDetail") {
        const detail = line.JournalEntryLineDetail;
        const ref = detail?.AccountRef;
        const amount = line.Amount ?? 0;
        if (ref && amount > 0 && detail?.PostingType === "Debit") {
          const id = ref.value;
          if (!accountMap[id]) accountMap[id] = { accountName: ref.name, total: 0 };
          accountMap[id].total += amount;
        }
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

  if (!vendorId || !vendorName || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    // Fetch Bills, Checks, and Expenses for this vendor in the date range
    const txnTypes = [
      { entity: "Bill", dateField: "TxnDate" },
      { entity: "Purchase", dateField: "TxnDate" }, // covers Checks and Expenses
    ];

    const allTxns: QBOTransaction[] = [];

    for (const { entity } of txnTypes) {
      let position = 1;
      const PAGE = 100;
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
    }

    console.log(`Found ${allTxns.length} transactions for vendor ${vendorName}`);

    const accountTotals = extractExpenseLines(allTxns);
    const accounts = Object.entries(accountTotals)
      .map(([id, { accountName, total }]) => ({
        id,
        accountName,
        total: Math.round(total * 100) / 100,
      }))
      .filter(a => a.total > 0)
      .sort((a, b) => b.total - a.total);

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
