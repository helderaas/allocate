import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const showAll = req.nextUrl.searchParams.get("all") === "true";

  const db = getServiceSupabase();

  const { data: allDrafts, error } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at, total_debits, total_credits, description, qbo_journal_entry_id, voided_at, locked_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(200);


  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (showAll) {
    const drafts = (allDrafts ?? []).sort((a, b) => b.period.localeCompare(a.period));
    return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
  }

  const drafts = (allDrafts ?? []).sort((a, b) => b.period.localeCompare(a.period));
  return NextResponse.json({ drafts }, { headers: { "Cache-Control": "no-store" } });
}
