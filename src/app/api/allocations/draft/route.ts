import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period");
  if (!period) return NextResponse.json({ error: "Period required" }, { status: 400 });

  const db = getServiceSupabase();

  const { data: rows, error } = await db
    .from("allocation_drafts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("period", period)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  // _serverTs lets us confirm in the browser that this is a fresh server response
  return NextResponse.json({ draft: rows[0], _serverTs: new Date().toISOString() }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
