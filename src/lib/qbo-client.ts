import axios from "axios";
import { QBOTokens, QBOAccount, QBOLocation } from "@/types";
import { getServiceSupabase } from "./supabase";

const QBO_BASE = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com",
  production: "https://quickbooks.api.intuit.com",
};

const env = (process.env.QBO_ENVIRONMENT ?? "sandbox") as "sandbox" | "production";

export async function refreshQBOToken(tenantId: string, refreshToken: string): Promise<QBOTokens> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString("base64");

  const { data } = await axios.post<QBOTokens>(
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    params.toString(),
    { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const db = getServiceSupabase();
  await db.from("tenants").update({
    qbo_access_token: data.access_token,
    qbo_refresh_token: data.refresh_token,
    qbo_token_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }).eq("id", tenantId);

  return data;
}

export async function qboRequest<T>(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string,
  path: string, params?: Record<string, string>
): Promise<T> {
  const base = `${QBO_BASE[env]}/v3/company/${realmId}`;
  try {
    const { data } = await axios.get<T>(`${base}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      params,
    });
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      const { data } = await axios.get<T>(`${base}${path}`, {
        headers: { Authorization: `Bearer ${newTokens.access_token}`, Accept: "application/json" },
        params,
      });
      return data;
    }
    throw err;
  }
}

export async function fetchAccounts(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string
): Promise<QBOAccount[]> {
  const data = await qboRequest<{ QueryResponse: { Account: QBOAccount[] } }>(
    tenantId, realmId, accessToken, refreshToken, "/query",
    { query: "SELECT Id, Name, FullyQualifiedName, AccountType, AccountSubType, Active, SubAccount FROM Account STARTPOSITION 1 MAXRESULTS 100" }
  );
  return data.QueryResponse?.Account ?? [];
}

export async function fetchLocations(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string
): Promise<QBOLocation[]> {
  const data = await qboRequest<{ QueryResponse: { Department: QBOLocation[] } }>(
    tenantId, realmId, accessToken, refreshToken, "/query",
    { query: "SELECT * FROM Department MAXRESULTS 50" }
  );
  return data.QueryResponse.Department ?? [];
}

// ── Trial Balance ─────────────────────────────────────────────────────────────
// Returns a map of QBO account ID → net balance for the period.
// The TrialBalance report rows have ColData arrays: [account name, debit, credit].
// We return debit - credit so expense accounts come out positive (their natural sign).

interface TBRow {
  ColData?: { value: string; id?: string }[];
  Rows?: { Row?: TBRow[] };
  type?: string;
  group?: string;
}

interface TrialBalanceReport {
  Rows: { Row: TBRow[] };
}

export async function fetchTrialBalance(
  tenantId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string,
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const data = await qboRequest<{ Report: TrialBalanceReport }>(
    tenantId, realmId, accessToken, refreshToken,
    "/reports/TrialBalance",
    { start_date: startDate, end_date: endDate, accounting_method: "Accrual" }
  );

  const balances: Record<string, number> = {};

  function walkRows(rows: TBRow[]) {
    for (const row of rows) {
      // Data rows have ColData with an account id in the first cell
      if (row.ColData && row.ColData.length >= 3) {
        const accountId = row.ColData[0]?.id;
        const debit = parseFloat(row.ColData[1]?.value ?? "0") || 0;
        const credit = parseFloat(row.ColData[2]?.value ?? "0") || 0;
        if (accountId) {
          // Net: debit - credit. For expense accounts this gives the expense amount.
          // For income accounts this gives a negative (credit-heavy) number.
          balances[accountId] = debit - credit;
        }
      }
      // Recurse into nested row groups
      if (row.Rows?.Row) {
        walkRows(row.Rows.Row);
      }
    }
  }

  const topRows = data?.Report?.Rows?.Row ?? [];
  walkRows(topRows);

  return balances;
}

// ── P&L Revenue by Division ───────────────────────────────────────────────────
// Fetches the ProfitAndLoss report filtered to each division location separately,
// sums total income for each, and returns the percentage split.
// Falls back to 50/50 if the report returns zeros for both (e.g. sandbox with no data).

interface PLReport {
  Rows: { Row: TBRow[] };
}

function sumIncomeFromPL(rows: TBRow[]): number {
  let total = 0;
  for (const row of rows) {
    // Summary rows (type=Section, group=Income) contain a summary ColData
    if (row.group === "Income" && row.ColData) {
      const val = parseFloat(row.ColData[1]?.value ?? "0") || 0;
      total += val;
    }
    // Also accumulate individual income line items
    if (row.ColData && row.ColData.length >= 2 && row.type === "Data") {
      // We'll let the section summary handle the total — skip raw data rows here
    }
    if (row.Rows?.Row) {
      total += sumIncomeFromPL(row.Rows.Row);
    }
  }
  return total;
}

export async function fetchRevenueSplit(
  tenantId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
  divisionALocationId: string,
  divisionBLocationId: string
): Promise<{ divisionAPct: number; divisionBPct: number }> {
  // Fetch P&L for each division in parallel
  const [plA, plB] = await Promise.all([
    qboRequest<{ Report: PLReport }>(
      tenantId, realmId, accessToken, refreshToken,
      "/reports/ProfitAndLoss",
      {
        start_date: startDate,
        end_date: endDate,
        accounting_method: "Accrual",
        department: divisionALocationId,
      }
    ),
    qboRequest<{ Report: PLReport }>(
      tenantId, realmId, accessToken, refreshToken,
      "/reports/ProfitAndLoss",
      {
        start_date: startDate,
        end_date: endDate,
        accounting_method: "Accrual",
        department: divisionBLocationId,
      }
    ),
  ]);

  const revenueA = Math.abs(sumIncomeFromPL(plA?.Report?.Rows?.Row ?? []));
  const revenueB = Math.abs(sumIncomeFromPL(plB?.Report?.Rows?.Row ?? []));
  const totalRevenue = revenueA + revenueB;

  // Fall back to 50/50 if no revenue data (avoids division by zero)
  if (totalRevenue === 0) {
    return { divisionAPct: 50, divisionBPct: 50 };
  }

  const divisionAPct = Math.round((revenueA / totalRevenue) * 10000) / 100; // 2 decimal places
  const divisionBPct = Math.round((revenueB / totalRevenue) * 10000) / 100;

  return { divisionAPct, divisionBPct };
}

export async function postJournalEntry(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string,
  payload: object
): Promise<{ Id: string }> {
  const base = `${QBO_BASE[env]}/v3/company/${realmId}`;
  try {
    const { data } = await axios.post<{ JournalEntry: { Id: string } }>(
      `${base}/journalentry`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" } }
    );
    return data.JournalEntry;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      const { data } = await axios.post<{ JournalEntry: { Id: string } }>(
        `${base}/journalentry`,
        payload,
        { headers: { Authorization: `Bearer ${newTokens.access_token}`, Accept: "application/json", "Content-Type": "application/json" } }
      );
      return data.JournalEntry;
    }
    throw err;
  }
}

export async function voidJournalEntry(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string,
  journalEntryId: string
): Promise<void> {
  const base = `${QBO_BASE[env]}/v3/company/${realmId}`;
  try {
    await axios.post(
      `${base}/journalentry?operation=void`,
      { Id: journalEntryId, SyncToken: "0" },
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      await axios.post(
        `${base}/journalentry?operation=void`,
        { Id: journalEntryId, SyncToken: "0" },
        { headers: { Authorization: `Bearer ${newTokens.access_token}`, Accept: "application/json", "Content-Type": "application/json" } }
      );
    }
    throw err;
  }
}
