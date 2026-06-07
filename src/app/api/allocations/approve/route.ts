import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { buildJournalEntryPayload } from "@/lib/allocation-engine";
import { postJournalEntry, voidJournalEntry } from "@/lib/qbo-client";
import { AllocationDraft } from "@/types";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await req.json();
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

  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // If already posted, void the existing JE in QBO first
  if (draft.status === "posted" && draft.qbo_journal_entry_id) {
    try {
      await voidJournalEntry(
        tenant.id,
        tenant.qbo_realm_id,
        tenant.qbo_access_token,
        tenant.qbo_refresh_token,
        draft.qbo_journal_entry_id
      );
    } catch (err) {
      console.error("Failed to void existing JE:", err);
      // Continue anyway — the old JE may already be voided
    }
  }

  const lines = typeof draft.lines === "string" ? JSON.parse(draft.lines) : draft.lines;
  const draftWithLines: AllocationDraft = { ...draft, lines };

  const payload = buildJournalEntryPayload(
    draftWithLines,
    tenant.division_a_location_id,
    tenant.division_b_location_id,
    draft.period,
    draft.je_date,
    draft.description,
    draft.journal_number
  );

  const je = await postJournalEntry(
    tenant.id,
    tenant.qbo_realm_id,
    tenant.qbo_access_token,
    tenant.qbo_refresh_token,
    payload
  );

  await db
    .from("allocation_drafts")
    .update({
      status: "posted",
      qbo_journal_entry_id: je.Id,
      posted_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  return NextResponse.json({ ok: true, journalEntryId: je.Id });
}
