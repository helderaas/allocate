import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchAccounts } from "@/lib/qbo-client";
import axios from "axios";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const accounts = await fetchAccounts(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token
    );
    return NextResponse.json({ accounts });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const detail = JSON.stringify(err.response?.data ?? err.message);
      console.error("QBO accounts error:", status, detail);
      return NextResponse.json(
        { error: `QBO API error ${status}`, detail },
        { status: 500 }
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("QBO accounts error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
