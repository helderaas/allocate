import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { voidJournalEntry } from "@/lib/qbo-client";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await req.json();
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

  // Mark as voided in our DB
  await db
    .from("allocation_drafts")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  return NextResponse.json({ ok: true });
}
