import axios from "axios";
import { QBOTokens, QBOAccount, QBOLocation } from "@/types";
import { getServiceSupabase } from "./supabase";

// Thrown when the QBO refresh token itself is expired — user must reconnect
export class QBOAuthExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QBOAuthExpiredError";
  }
}

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

  try {
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
  } catch (err: unknown) {
    // Refresh token itself is expired — user must reconnect QBO
    const status = axios.isAxiosError(err) ? err.response?.status : null;
    const qboError = axios.isAxiosError(err) ? err.response?.data?.error : null;
    if (status === 400 || status === 401 || qboError === "invalid_grant") {
      throw new QBOAuthExpiredError("QBO session expired. Please reconnect QuickBooks.");
    }
    throw err;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function qboRequest<T>(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string,
  path: string, params?: Record<string, string>,
  retries = 3
): Promise<T> {
  const base = `${QBO_BASE[env]}/v3/company/${realmId}`;
  try {
    const { data } = await axios.get<T>(`${base}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      params,
    });
    return data;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      // 401 — refresh token and retry once
      if (err.response?.status === 401) {
        const newTokens = await refreshQBOToken(tenantId, refreshToken);
        const { data } = await axios.get<T>(`${base}${path}`, {
          headers: { Authorization: `Bearer ${newTokens.access_token}`, Accept: "application/json" },
          params,
        });
        return data;
      }
      // 429 — rate limited, wait and retry with exponential backoff
      if (err.response?.status === 429 && retries > 0) {
        const retryAfter = parseInt(err.response.headers["retry-after"] ?? "2") * 1000;
        const delay = retryAfter || (2 ** (3 - retries)) * 1000; // 1s, 2s, 4s
        console.log(`QBO rate limited, retrying in ${delay}ms (${retries} retries left)`);
        await sleep(delay);
        return qboRequest<T>(tenantId, realmId, accessToken, refreshToken, path, params, retries - 1);
      }
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
export async function fetchCompanyInfo(
  tenantId: string, realmId: string, accessToken: string, refreshToken: string
): Promise<{ CompanyName: string; Country: string } | null> {
  try {
    const data = await qboRequest<{ QueryResponse: { CompanyInfo: { CompanyName: string; Country: string }[] } }>(
      tenantId, realmId, accessToken, refreshToken, "/query",
      { query: "SELECT CompanyName, Country FROM CompanyInfo" }
    );
    return data.QueryResponse?.CompanyInfo?.[0] ?? null;
  } catch {
    return null;
  }
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
    if (row.type === "Section" && row.group !== "GrandTotal") {
      const hasNestedSections = row.Rows?.Row?.some(
        (r) => (r as GLRow).type === "Section" && (r as GLRow).group !== "GrandTotal"
      );
      if (!hasNestedSections && row.Summary?.ColData) {
        // Find the amount column - try index 7 first (production), fall back to 6 (sandbox)
        const colData = row.Summary.ColData;
        const val7 = parseFloat(colData[7]?.value || "0") || 0;
        const val6 = parseFloat(colData[6]?.value || "0") || 0;
        const val = val7 !== 0 ? val7 : val6;
        total += val;
      }
      if (row.Rows?.Row?.length) {
        total += sumGLSections(row.Rows.Row);
      }
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

export interface Division {
  id: string;
  name: string;
  qbo_location_id?: string | null;
  qbo_class_id?: string | null;
}

export interface GLBreakdown {
  total: number;
  taggedPerDivision: Record<string, number>; // divisionId -> tagged amount
  untagged: number;
}

// Legacy interface for backwards compatibility
export interface GLBreakdownLegacy {
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
  divisions: Division[],
  trackingType: "location" | "class" = "location"
): Promise<Record<string, GLBreakdown>> {
  const results: Record<string, GLBreakdown> = {};

  // Process accounts in batches of 3 to avoid QBO rate limits
  const BATCH_SIZE = 3;
  for (let i = 0; i < accountIds.length; i += BATCH_SIZE) {
    const batch = accountIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (accountId) => {
      const baseParams = {
        start_date: startDate,
        end_date: endDate,
        account: accountId,
        accounting_method: "Accrual",
      };

      // Fetch total + each division in parallel
      const [glTotal, ...divisionGLs] = await Promise.all([
        qboRequest<{ Rows: { Row: GLRow[] } }>(
          tenantId, realmId, accessToken, refreshToken,
          "/reports/GeneralLedger", baseParams
        ),
        ...divisions.map(div => {
          const filterId = trackingType === "class" ? div.qbo_class_id : div.qbo_location_id;
          if (!filterId) return Promise.resolve({ Rows: { Row: [] } });
          const filterParam: Record<string, string> = trackingType === "class" 
            ? { class: filterId } 
            : { department: filterId };
          return qboRequest<{ Rows: { Row: GLRow[] } }>(
            tenantId, realmId, accessToken, refreshToken,
            "/reports/GeneralLedger",
            { ...baseParams, ...filterParam }
          );
        }),
      ]);

      const total = sumGLSections(glTotal?.Rows?.Row ?? []);
      const taggedPerDivision: Record<string, number> = {};
      let totalTagged = 0;

      divisions.forEach((div, i) => {
        const tagged = sumGLSections(divisionGLs[i]?.Rows?.Row ?? []);
        taggedPerDivision[div.id] = tagged;
        totalTagged += tagged;
      });

      const untagged = Math.max(0, total - totalTagged);
      results[accountId] = { total, taggedPerDivision, untagged };
    })
    );
    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < accountIds.length) await sleep(300);
  }

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
  divisions: Division[],
  trackingType: "location" | "class" = "location"
): Promise<Record<string, number>> {
  // Returns a map of divisionId -> revenue percentage
  if (divisions.length === 0) return {};

  const plResults = await Promise.all(
    divisions.map(div => {
      const filterId = trackingType === "class" ? div.qbo_class_id : div.qbo_location_id;
      if (!filterId) return Promise.resolve({ Report: { Rows: { Row: [] } } });
      const filterParam: Record<string, string> = trackingType === "class" ? { class: filterId } : { department: filterId };
      return qboRequest<{ Report: PLReport }>(
        tenantId, realmId, accessToken, refreshToken,
        "/reports/ProfitAndLoss",
        { start_date: startDate, end_date: endDate, accounting_method: "Accrual", ...filterParam }
      );
    })
  );

  const revenues = plResults.map(pl =>
    Math.abs(sumIncomeFromPL((pl?.Report?.Rows?.Row ?? []) as PLRow[]))
  );
  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);

  // Fall back to equal split if no revenue data
  if (totalRevenue === 0) {
    const equalPct = Math.round(10000 / divisions.length) / 100;
    return Object.fromEntries(divisions.map(d => [d.id, equalPct]));
  }

  return Object.fromEntries(
    divisions.map((d, i) => [
      d.id,
      Math.round((revenues[i] / totalRevenue) * 10000) / 100,
    ])
  );
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

  // QBO requires the current SyncToken to void — fetch it first
  let currentToken = accessToken;
  let syncToken = "0";
  try {
    const { data: jeData } = await axios.get(
      `${base}/journalentry/${journalEntryId}`,
      { headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" } }
    );
    syncToken = jeData?.JournalEntry?.SyncToken ?? "0";
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      currentToken = newTokens.access_token;
      const { data: jeData } = await axios.get(
        `${base}/journalentry/${journalEntryId}`,
        { headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json" } }
      );
      syncToken = jeData?.JournalEntry?.SyncToken ?? "0";
    } else {
      console.error("Failed to fetch JE for void:", axios.isAxiosError(err) ? err.response?.data : err);
      throw err;
    }
  }

  // Now void with the correct SyncToken
  try {
    await axios.post(
      `${base}/journalentry?operation=void`,
      { Id: journalEntryId, SyncToken: syncToken },
      { headers: { Authorization: `Bearer ${currentToken}`, Accept: "application/json", "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      const newTokens = await refreshQBOToken(tenantId, refreshToken);
      await axios.post(
        `${base}/journalentry?operation=void`,
        { Id: journalEntryId, SyncToken: syncToken },
        { headers: { Authorization: `Bearer ${newTokens.access_token}`, Accept: "application/json", "Content-Type": "application/json" } }
      );
      return;
    }
    console.error("QBO void error:", axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : err);
    throw err;
  }
}





