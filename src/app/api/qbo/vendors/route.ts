import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest, refreshQBOToken } from "@/lib/qbo-client";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const data = await qboRequest<{ QueryResponse: { Vendor: { Id: string; DisplayName: string; Active: boolean }[] } }>(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      "/query",
      { query: "SELECT Id, DisplayName, Active FROM Vendor WHERE Active = true ORDERBY DisplayName STARTPOSITION 1 MAXRESULTS 500" }
    );
    const vendors = data.QueryResponse?.Vendor ?? [];
    return NextResponse.json({ vendors });
  } catch (err) {
    console.error("Failed to fetch vendors:", err);
    return NextResponse.json({ vendors: [] });
  }
}
