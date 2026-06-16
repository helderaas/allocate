import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { qboRequest } from "@/lib/qbo-client";

interface Vendor { Id: string; DisplayName: string; Active: boolean; }

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const allVendors: Vendor[] = [];
    const PAGE_SIZE = 1000;
    let position = 1;
    let hasMore = true;

    while (hasMore) {
      const data = await qboRequest<{ QueryResponse: { Vendor?: Vendor[]; maxResults?: number } }>(
        tenant.id, tenant.qbo_realm_id,
        tenant.qbo_access_token, tenant.qbo_refresh_token,
        "/query",
        { query: `SELECT Id, DisplayName, Active FROM Vendor WHERE Active = true ORDERBY DisplayName STARTPOSITION ${position} MAXRESULTS ${PAGE_SIZE}` }
      );
      const page = data.QueryResponse?.Vendor ?? [];
      allVendors.push(...page);
      hasMore = page.length === PAGE_SIZE;
      position += PAGE_SIZE;
    }

    return NextResponse.json({ vendors: allVendors });
  } catch (err) {
    console.error("Failed to fetch vendors:", err);
    return NextResponse.json({ vendors: [] });
  }
}
