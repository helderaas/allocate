import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// POST instead of GET so Vercel's edge cache never intercepts this request
export async function DELETE(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { draftId } = await req.json();
  if (!draftId) return NextResponse.json({ error: "draftId required" }, { status: 400 });

  const db = getServiceSupabase();

  await db
    .from("allocation_drafts")
    .delete()
    .eq("id", draftId)
    .eq("tenant_id", tenantId)
    .eq("status", "draft"); // safety: only delete drafts, never posted/voided

  return NextResponse.json({ ok: true });
}
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period } = await req.json();
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

  return NextResponse.json({ draft: rows[0] });
}
