import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();

  const { data: allDrafts, error } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at, total_debits, total_credits, description, qbo_journal_entry_id, voided_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each period, show the most important record:
  // posted > voided > draft (in that priority order)
  // This prevents stale drafts from obscuring posted entries for the same period
  const statusPriority: Record<string, number> = { posted: 3, voided: 2, draft: 1 };
  const byPeriod = new Map<string, typeof allDrafts[0]>();

  for (const draft of (allDrafts ?? [])) {
    const existing = byPeriod.get(draft.period);
    const newPriority = statusPriority[draft.status] ?? 0;
    const existingPriority = existing ? (statusPriority[existing.status] ?? 0) : -1;
    if (!existing || newPriority > existingPriority) {
      byPeriod.set(draft.period, draft);
    }
  }

  // Sort by period descending
  const drafts = Array.from(byPeriod.values())
    .sort((a, b) => b.period.localeCompare(a.period));

  return NextResponse.json({ drafts }, {
    headers: { "Cache-Control": "no-store" },
  });
}
