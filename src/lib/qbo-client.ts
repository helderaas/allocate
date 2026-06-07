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

// ── General Ledger balance extraction ────────────────────────────────────────
// Parses a GL report response and returns the sum of all Section-level totals.
// The GL report groups transactions under account sections. Each Section has
// a Summary with ColData[6] = total amount for that account group.

interface GLRow {
  ColData?: { value: string; id?: string }[];
  Summary?: { ColData?: { value: string }[] };
  Rows?: { Row?: GLRow[] };
  type?: string;
  group?: string;
}

function sumGLSections(rows: GLRow[]): number {
  let total = 0;
  for (const row of rows) {
    // Skip the GrandTotal section — we only want per-account section totals
    if (row.type === "Section" && row.group !== "GrandTotal" && row.Summary?.ColData) {
      const val = parseFloat(row.Summary.ColData[6]?.value || "0") || 0;
      total += val;
    }
    if (row.Rows?.Row?.length) {
      total += sumGLSections(row.Rows.Row);
    }
  }
  return total;
}

// ── fetchGLBalances ───────────────────────────────────────────────────────────
// For each configured account, fetches three GL totals:
//   total     = company-wide balance (no department filter)
//   taggedA   = transactions already tagged to Division A
//   taggedB   = transactions already tagged to Division B
//   untagged  = total - taggedA - taggedB  (what this JE will allocate)
//
// All three calls run in parallel per account, then all accounts run in parallel.

export interface GLBreakdown {
  total: number;
  taggedA: number;
  taggedB: number;
  untagged: number;
}

export async function fetchGLBalances(
  tenantId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string,
  startDate: string,
  endDate: string,
  accountIds: string[],
  divisionALocationId: string,
  divisionBLocationId: string
): Promise<Record<string, GLBreakdown>> {
  const results: Record<string, GLBreakdown> = {};

  // Fetch all accounts in parallel, each with 3 GL calls
  await Promise.all(
    accountIds.map(async (accountId) => {
      const baseParams = {
        start_date: startDate,
        end_date: endDate,
        account: accountId,
        accounting_method: "Accrual",
      };

      const [glTotal, glDivA, glDivB] = await Promise.all([
        qboRequest<{ Rows: { Row: GLRow[] } }>(
          tenantId, realmId, accessToken, refreshToken,
          "/reports/GeneralLedger", baseParams
        ),
        qboRequest<{ Rows: { Row: GLRow[] } }>(
          tenantId, realmId, accessToken, refreshToken,
          "/reports/GeneralLedger",
          { ...baseParams, department: divisionALocationId }
        ),
        qboRequest<{ Rows: { Row: GLRow[] } }>(
          tenantId, realmId, accessToken, refreshToken,
          "/reports/GeneralLedger",
          { ...baseParams, department: divisionBLocationId }
        ),
      ]);

      const total = sumGLSections(glTotal?.Rows?.Row ?? []);
      const taggedA = sumGLSections(glDivA?.Rows?.Row ?? []);
      const taggedB = sumGLSections(glDivB?.Rows?.Row ?? []);
      // Guard against negative untagged (shouldn't happen but be safe)
      const untagged = Math.max(0, total - taggedA - taggedB);

      results[accountId] = { total, taggedA, taggedB, untagged };
    })
  );

  return results;
}

// ── P&L Revenue by Division ───────────────────────────────────────────────────
interface PLRow {
  ColData?: { value: string; id?: string }[];
  Rows?: { Row?: PLRow[] };
  type?: string;
  group?: string;
}

interface PLReport {
  Rows: { Row: PLRow[] };
}

function sumIncomeFromPL(rows: PLRow[], insideIncome = false): number {
  let total = 0;
  for (const row of rows) {
    const isIncomeSection = row.group === "Income" || row.group === "OtherIncome";
    const nowInsideIncome = insideIncome || isIncomeSection;

    if (nowInsideIncome && row.type === "Data" && row.ColData && row.ColData.length >= 2) {
      const val = parseFloat(row.ColData[1]?.value || "0") || 0;
      total += val;
    }
    if (row.Rows?.Row?.length) {
      total += sumIncomeFromPL(row.Rows.Row, nowInsideIncome);
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
  const [plA, plB] = await Promise.all([
    qboRequest<{ Report: PLReport }>(
      tenantId, realmId, accessToken, refreshToken,
      "/reports/ProfitAndLoss",
      { start_date: startDate, end_date: endDate, accounting_method: "Accrual", department: divisionALocationId }
    ),
    qboRequest<{ Report: PLReport }>(
      tenantId, realmId, accessToken, refreshToken,
      "/reports/ProfitAndLoss",
      { start_date: startDate, end_date: endDate, accounting_method: "Accrual", department: divisionBLocationId }
    ),
  ]);

  const revenueA = Math.abs(sumIncomeFromPL((plA?.Report?.Rows?.Row ?? []) as PLRow[]));
  const revenueB = Math.abs(sumIncomeFromPL((plB?.Report?.Rows?.Row ?? []) as PLRow[]));
  const totalRevenue = revenueA + revenueB;

  if (totalRevenue === 0) {
    return { divisionAPct: 50, divisionBPct: 50 };
  }

  return {
    divisionAPct: Math.round((revenueA / totalRevenue) * 10000) / 100,
    divisionBPct: Math.round((revenueB / totalRevenue) * 10000) / 100,
  };
}

export async function postJournalEntry(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string,
  payload: object
): Promise<{ Id: string }> {
  const base = `${QBO_BASE[env]}/v3/company/${realmId}`;
  try {
    const { data } = await axios.post<{ JournalEntry: { Id: string } }>(
      `${base}/journalentry`, payload,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" } }
    );
    return data.JournalEntry;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      const { data } = await axios.post<{ JournalEntry: { Id: string } }>(
        `${base}/journalentry`, payload,
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
