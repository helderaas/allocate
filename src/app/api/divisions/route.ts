import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();
  const { data: divisions } = await db
    .from("divisions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  const { data: tenant } = await db
    .from("tenants")
    .select("division_tracking_type")
    .eq("id", tenantId)
    .single();

  return NextResponse.json({
    divisions: divisions ?? [],
    trackingType: tenant?.division_tracking_type ?? "location",
  });
}

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { divisions, trackingType } = await req.json();

  if (!divisions?.length || divisions.length < 1) {
    return NextResponse.json({ error: "At least 1 division required" }, { status: 400 });
  }

  const db = getServiceSupabase();

  // Update tracking type on tenant
  await db.from("tenants")
    .update({ division_tracking_type: trackingType })
    .eq("id", tenantId);

  // Replace all divisions for this tenant
  await db.from("divisions").delete().eq("tenant_id", tenantId);

  const { data, error } = await db.from("divisions").insert(
    divisions.map((d: { name: string; qbo_location_id?: string; qbo_class_id?: string }, i: number) => ({
      tenant_id: tenantId,
      name: d.name,
      qbo_location_id: d.qbo_location_id ?? null,
      qbo_class_id: d.qbo_class_id ?? null,
      sort_order: i,
    }))
  ).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also update legacy division_a/b columns for backwards compatibility
  if (divisions.length >= 1) {
    const updateData: Record<string, string | null> = {
      division_a_location_id: trackingType === "location" ? (divisions[0].qbo_location_id ?? null) : null,
      division_a_location_name: divisions[0].name,
    };
    if (divisions.length >= 2) {
      updateData.division_b_location_id = trackingType === "location" ? (divisions[1].qbo_location_id ?? null) : null;
      updateData.division_b_location_name = divisions[1].name;
    }
    await db.from("tenants").update(updateData).eq("id", tenantId);
  }

  return NextResponse.json({ divisions: data });
}
