import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchCompanyInfo } from "@/lib/qbo-client";
import { safeDecrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, isFirmCompany } = await req.json();
  if (!tenantId || isFirmCompany === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Verify tenant belongs to this firm and get QBO tokens
  const { data: tenant } = await db
    .from("tenants")
    .select("id, qbo_realm_id, qbo_access_token, qbo_refresh_token, company_name")
    .eq("id", tenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch company name from QBO if not already set
  let companyName = tenant.company_name;
  if (!companyName && tenant.qbo_access_token && tenant.qbo_realm_id) {
    try {
      const info = await fetchCompanyInfo(
        tenantId,
        tenant.qbo_realm_id,
        tenant.qbo_access_token,
        safeDecrypt(tenant.qbo_refresh_token)
      );
      companyName = info?.CompanyName ?? null;
    } catch { /* non-fatal */ }
  }

  await db.from("tenants")
    .update({ 
      is_firm_company: isFirmCompany,
      ...(companyName ? { company_name: companyName } : {})
    })
    .eq("id", tenantId);

  return NextResponse.json({ ok: true, companyName });
}
