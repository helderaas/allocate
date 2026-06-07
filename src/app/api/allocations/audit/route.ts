import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const draftId = req.nextUrl.searchParams.get("draftId");
  if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

  const db = getServiceSupabase();

  // Verify the draft belongs to this tenant
  const { data: draft } = await db
    .from("allocation_drafts")
    .select("id")
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .single();

  if (!draft) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: logs, error } = await db
    .from("allocation_audit_log")
    .select("id, action, je_id_before, je_id_after, note, created_at")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs });
}
// v1
