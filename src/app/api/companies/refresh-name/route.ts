import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, qbo_realm_id, qbo_access_token, qbo_refresh_token, company_name")
    .eq("id", tenantId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (tenant.company_name) return NextResponse.json({ company_name: tenant.company_name });

  try {
    const info = await fetchCompanyInfo(
      tenant.id,
      tenant.qbo_realm_id,
      tenant.qbo_access_token,
      tenant.qbo_refresh_token
    );
    if (info?.CompanyName) {
      await db.from("tenants").update({ company_name: info.CompanyName }).eq("id", tenantId);
      return NextResponse.json({ company_name: info.CompanyName });
    }
    return NextResponse.json({ company_name: null });
  } catch (e) {
    console.error("refresh-name error:", e);
    return NextResponse.json({ error: "Failed to fetch company name" }, { status: 500 });
  }
}
