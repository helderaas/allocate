import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { voidJournalEntry } from "@/lib/qbo-client";

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
  if (!draft.qbo_journal_entry_id) return NextResponse.json({ error: "No QBO journal entry ID found" }, { status: 400 });

  // Locked entries can still be voided — that's intentional (void is the only escape from locked)
  const { data: tenant } = await db
    .from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    await voidJournalEntry(
      tenant.id,
      tenant.qbo_realm_id,
      tenant.qbo_access_token,
      tenant.qbo_refresh_token,
      draft.qbo_journal_entry_id
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to void in QBO: ${msg}` }, { status: 500 });
  }

  await db
    .from("allocation_drafts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      locked_at: null, // unlock if it was locked
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

  return NextResponse.json({ ok: true });
}
// v2
