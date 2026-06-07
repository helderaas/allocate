import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId, lock } = await req.json();
  // lock: true = lock, false = unlock
  if (!draftId || lock === undefined) {
    return NextResponse.json({ error: "draftId and lock required" }, { status: 400 });
  }

  const db = getServiceSupabase();

  const { data: draft } = await db
    .from("allocation_drafts")
    .select("id, status, locked_at, tenant_id")
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "posted") return NextResponse.json({ error: "Only posted entries can be locked" }, { status: 400 });

  await db
    .from("allocation_drafts")
    .update({ locked_at: lock ? new Date().toISOString() : null })
    .eq("id", draftId);

  // Write audit log
  await db.from("allocation_audit_log").insert({
    draft_id: draftId,
    tenant_id: tenantId,
    action: lock ? "locked" : "unlocked",
    je_id_before: null,
    je_id_after: null,
    previous_lines: null,
    new_lines: null,
    note: null,
  });

  return NextResponse.json({ ok: true, locked: lock });
}
// v1
