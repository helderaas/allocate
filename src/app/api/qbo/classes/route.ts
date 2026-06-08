import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest } from "@/lib/qbo-client";
import axios from "axios";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const data = await qboRequest<{ QueryResponse: { Class: { Id: string; Name: string; FullyQualifiedName: string; Active: boolean }[] } }>(
      tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/query", { query: "SELECT Id, Name, FullyQualifiedName, Active FROM Class MAXRESULTS 100" }
    );
    return NextResponse.json({ classes: data.QueryResponse?.Class ?? [] });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      return NextResponse.json({ error: `QBO API error ${err.response?.status}` }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to fetch classes" }, { status: 500 });
  }
}
