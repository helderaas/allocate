import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "No tenant_id cookie" });

  const db = getServiceSupabase();
  const { data: drafts } = await db
    .from("allocation_drafts")
    .select("id, period, status, tenant_id, qbo_journal_entry_id")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: tenants } = await db
    .from("tenants")
    .select("id, qbo_realm_id, division_a_location_id, division_b_location_id");

  return NextResponse.json({ 
    cookieTenantId: tenantId,
    allTenants: tenants,
    allDrafts: drafts,
  });
}
