import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, isFirmCompany } = await req.json();
  if (!tenantId || isFirmCompany === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Verify tenant belongs to this firm
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("id", tenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.from("tenants")
    .update({ is_firm_company: isFirmCompany })
    .eq("id", tenantId);

  return NextResponse.json({ ok: true });
}
