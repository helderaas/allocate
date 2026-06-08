import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showAll = req.nextUrl.searchParams.get("all") === "true";

  // Create a brand new client each time to avoid any connection reuse
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { headers: { "Cache-Control": "no-cache" } } }
  );

  const { data: allDrafts, error } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at, total_debits, total_credits, description, qbo_journal_entry_id, voided_at, locked_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  console.log("History API — tenantId:", tenantId, "error:", error?.message, "rows:", allDrafts?.map(d => d.id.slice(0,8) + ":" + d.status));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (showAll) {
    const drafts = (allDrafts ?? []).sort((a, b) => b.period.localeCompare(a.period));
    return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
  }

  // Dashboard — deduplicate by period, best status wins
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

  const drafts = Array.from(byPeriod.values())
    .sort((a, b) => b.period.localeCompare(a.period));

  return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
}
