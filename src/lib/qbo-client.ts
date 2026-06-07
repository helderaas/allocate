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
