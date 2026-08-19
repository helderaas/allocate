import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ companies: [] });

  const db = getServiceSupabase();
  const { data: tenants } = await db
    .from("tenants")
    .select("id, qbo_realm_id, division_a_location_name, division_b_location_name, company_name, qbo_connected, is_firm_company")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ companies: tenants ?? [] });
}

// Switch active company
export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = await req.json();
  const db = getServiceSupabase();

  // Verify this tenant belongs to the firm
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("tenant_id", tenantId, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  return response;
}
