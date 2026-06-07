import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "No tenant_id cookie" }, { status: 401 });

  const db = getServiceSupabase();

  // Get the most recent draft and show its full lines
  const { data: drafts } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at, lines, tenant_id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(3);

  // Also check: are there ANY drafts in the table for period 2026-05 regardless of tenant?
  const { data: allDraftsForPeriod } = await db
    .from("allocation_drafts")
    .select("id, tenant_id, period, status, created_at")
    .eq("period", "2026-05")
    .order("created_at", { ascending: false });

  return NextResponse.json({
    tenantId,
    myRecentDrafts: drafts?.map(d => ({
      ...d,
      lines: typeof d.lines === "string" ? JSON.parse(d.lines) : d.lines,
    })),
    allDraftsForPeriod,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
