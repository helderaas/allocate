import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId, note } = await req.json();
  if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

  const db = getServiceSupabase();

  const { data: draft } = await db
    .from("allocation_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .single();

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status !== "posted") return NextResponse.json({ error: "Only posted allocations can be voided" }, { status: 400 });

  // Mark voided in Allocate only — user must manually void in QBO
  await db
    .from("allocation_drafts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      locked_at: null,
    })
    .eq("id", draftId);

  // Write audit log
  await db.from("allocation_audit_log").insert({
    draft_id: draftId,
    tenant_id: tenantId,
    action: "voided",
    je_id_before: draft.qbo_journal_entry_id,
    je_id_after: null,
    previous_lines: draft.lines,
    new_lines: null,
    note: note || null,
  });

  return NextResponse.json({ ok: true, manual_void_required: true, qbo_journal_entry_id: draft.qbo_journal_entry_id });
}
// v3
