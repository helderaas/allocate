import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: templates, error } = await db
    .from("allocation_templates")
    .select("id, name, rules, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, rules } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Template name required" }, { status: 400 });
  if (!rules?.length) return NextResponse.json({ error: "No rules to save" }, { status: 400 });

  const db = getServiceSupabase();
  const { data: template, error } = await db
    .from("allocation_templates")
    .insert({ tenant_id: tenantId, name: name.trim(), rules })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const db = getServiceSupabase();
  const { error } = await db
    .from("allocation_templates")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
