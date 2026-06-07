import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "No tenant_id cookie" }, { status: 401 });

  const db = getServiceSupabase();

  // Show ALL drafts for this tenant, all periods, with full lines
  const { data: allDrafts, error } = await db
    .from("allocation_drafts")
    .select("id, period, status, created_at, tenant_id, lines")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    tenantId,
    totalDrafts: allDrafts?.length ?? 0,
    allDrafts: allDrafts?.map(d => ({
      id: d.id,
      period: d.period,
      status: d.status,
      created_at: d.created_at,
      firstAccountName: (() => {
        try {
          const lines = typeof d.lines === "string" ? JSON.parse(d.lines) : d.lines;
          return lines?.[0]?.account_name ?? "none";
        } catch { return "parse error"; }
      })(),
    })),
    deleteError: error?.message,
  }, { headers: { "Cache-Control": "no-store" } });
}
