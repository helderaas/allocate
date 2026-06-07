import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { buildJournalEntryPayload } from "@/lib/allocation-engine";
import { postJournalEntry } from "@/lib/qbo-client";
import { AllocationDraft } from "@/types";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await req.json();

  const db = getServiceSupabase();

  // Get draft
  const { data: draft, error: draftError } = await db
    .from("allocation_drafts")
    .select("*")
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .single();

  if (draftError || !draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Get tenant
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  // Parse lines
  const lines = typeof draft.lines === "string"
    ? JSON.parse(draft.lines)
    : draft.lines;

  const draftWithLines: AllocationDraft = { ...draft, lines };

  // Build JE payload
  const payload = buildJournalEntryPayload(
    draftWithLines,
    tenant.division_a_location_id,
    tenant.division_b_location_id,
    draft.period
  );

  // Post to QBO
  const je = await postJournalEntry(
    tenant.id,
    tenant.qbo_realm_id,
    tenant.qbo_access_token,
    tenant.qbo_refresh_token,
    payload
  );

  // Update draft status
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