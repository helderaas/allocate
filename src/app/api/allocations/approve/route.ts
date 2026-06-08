import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { buildJournalEntryPayload } from "@/lib/allocation-engine";
import { postJournalEntry, voidJournalEntry, Division, QBOAuthExpiredError } from "@/lib/qbo-client";
import { AllocationDraft } from "@/types";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId, jeDate, description, journalNumber, lines: editedLines, note } = await req.json();
  const db = getServiceSupabase();

  const { data: draft, error: draftError } = await db
    .from("allocation_drafts").select("*").eq("id", draftId).eq("tenant_id", tenantId).single();
  if (draftError || !draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  if (draft.locked_at) {
    return NextResponse.json({ error: "This allocation is locked and cannot be amended. Unlock it first or void it." }, { status: 403 });
  }

  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Load divisions
  const { data: divisionRows } = await db
    .from("divisions").select("*").eq("tenant_id", tenantId).order("sort_order");

  let divisions: Division[];
  if (divisionRows && divisionRows.length > 0) {
    divisions = divisionRows.map(d => ({
      id: d.id, name: d.name,
      qbo_location_id: d.qbo_location_id,
      qbo_class_id: d.qbo_class_id,
    }));
  } else {
    divisions = [
      { id: "div-a", name: tenant.division_a_location_name ?? "Division A", qbo_location_id: tenant.division_a_location_id },
      { id: "div-b", name: tenant.division_b_location_name ?? "Division B", qbo_location_id: tenant.division_b_location_id },
    ];
  }

  const trackingType = tenant.division_tracking_type ?? "location";
  const isAmend = draft.status === "posted" && !!draft.qbo_journal_entry_id;
  const previousJeId = draft.qbo_journal_entry_id ?? null;
  const previousLines = draft.lines;

  if (isAmend) {
    try {
      await voidJournalEntry(tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token, draft.qbo_journal_entry_id);
    } catch (err) {
      if (err instanceof QBOAuthExpiredError) {
        return NextResponse.json({ error: "Your QuickBooks connection has expired. Please reconnect QBO from the dashboard.", qbo_reconnect_required: true }, { status: 401 });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Failed to void existing journal entry: ${msg}` }, { status: 500 });
    }
  }

  const lines = editedLines || (typeof draft.lines === "string" ? JSON.parse(draft.lines) : draft.lines);
  const draftWithLines: AllocationDraft = { ...draft, lines };

  const payload = buildJournalEntryPayload(
    draftWithLines, divisions, trackingType, draft.period,
    jeDate || draft.je_date, description || draft.description,
    journalNumber || draft.journal_number
  );

  let je: { Id: string };
  try {
    je = await postJournalEntry(tenant.id, tenant.qbo_realm_id, tenant.qbo_access_token, tenant.qbo_refresh_token, payload);
  } catch (err) {
    if (err instanceof QBOAuthExpiredError) {
      return NextResponse.json({ error: "Your QuickBooks connection has expired. Please reconnect QBO from the dashboard.", qbo_reconnect_required: true }, { status: 401 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to post journal entry: ${msg}` }, { status: 500 });
  }

  await db.from("allocation_drafts").update({
    status: "posted",
    qbo_journal_entry_id: je.Id,
    posted_at: new Date().toISOString(),
    lines: JSON.stringify(lines),
    je_date: jeDate, description, journal_number: journalNumber,
  }).eq("id", draftId);

  await db.from("allocation_audit_log").insert({
    draft_id: draftId, tenant_id: tenantId,
    action: isAmend ? "amended" : "posted",
    je_id_before: previousJeId, je_id_after: je.Id,
    previous_lines: isAmend ? previousLines : null,
    new_lines: JSON.stringify(lines),
    note: note || null,
  });

  return NextResponse.json({ ok: true, journalEntryId: je.Id, action: isAmend ? "amended" : "posted" });
}
// v3
