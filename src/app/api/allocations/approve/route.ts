import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { buildJournalEntryPayload } from "@/lib/allocation-engine";
import { postJournalEntry, voidJournalEntry } from "@/lib/qbo-client";
import { AllocationDraft } from "@/types";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId, jeDate, description, journalNumber, lines: editedLines, note } = await req.json();
  const db = getServiceSupabase();

  const { data: draft, error: draftError } = await db
    .from("allocation_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Block edits on locked entries
  if (draft.locked_at) {
    return NextResponse.json({ error: "This allocation is locked and cannot be amended. Unlock it first or void it." }, { status: 403 });
  }

  const { data: tenant } = await db
    .from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const isAmend = draft.status === "posted" && !!draft.qbo_journal_entry_id;
  const previousJeId = draft.qbo_journal_entry_id ?? null;
  const previousLines = draft.lines;

  // If already posted, void the existing JE in QBO first — hard fail if void fails
  if (isAmend) {
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
      return NextResponse.json(
        { error: `Failed to void existing journal entry in QBO before amending: ${msg}` },
        { status: 500 }
      );
    }
  }

  const lines = editedLines || (typeof draft.lines === "string" ? JSON.parse(draft.lines) : draft.lines);
  const draftWithLines: AllocationDraft = { ...draft, lines };

  const payload = buildJournalEntryPayload(
    draftWithLines,
    tenant.division_a_location_id,
    tenant.division_b_location_id,
    draft.period,
    jeDate || draft.je_date,
    description || draft.description,
    journalNumber || draft.journal_number
  );

  let je: { Id: string };
  try {
    je = await postJournalEntry(
      tenant.id,
      tenant.qbo_realm_id,
      tenant.qbo_access_token,
      tenant.qbo_refresh_token,
      payload
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to post journal entry to QBO: ${msg}` }, { status: 500 });
  }

  // Update draft record
  await db
    .from("allocation_drafts")
    .update({
      status: "posted",
      qbo_journal_entry_id: je.Id,
      posted_at: new Date().toISOString(),
      lines: JSON.stringify(lines),
      je_date: jeDate,
      description,
      journal_number: journalNumber,
    })
    .eq("id", draftId);

  // Write audit log entry
  await db.from("allocation_audit_log").insert({
    draft_id: draftId,
    tenant_id: tenantId,
    action: isAmend ? "amended" : "posted",
    je_id_before: previousJeId,
    je_id_after: je.Id,
    previous_lines: isAmend ? previousLines : null,
    new_lines: JSON.stringify(lines),
    note: note || null,
  });

  return NextResponse.json({ ok: true, journalEntryId: je.Id, action: isAmend ? "amended" : "posted" });
}
// v2
