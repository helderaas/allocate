import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchLocations } from "@/lib/qbo-client";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getServiceSupabase();

  // Check cache first
  const { data: cached } = await db
    .from("qbo_cache")
    .select("data, cached_at")
    .eq("tenant_id", tenantId)
    .eq("cache_key", "locations")
    .single();

  if (cached && (Date.now() - new Date(cached.cached_at).getTime()) < CACHE_TTL_MS) {
    return NextResponse.json({ locations: cached.data, fromCache: true });
  }

  const { data: tenant } = await db.from("tenants").select("*").eq("id", tenantId).single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  try {
    const locations = await fetchLocations(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token
    );

    // Save to cache
    await db.from("qbo_cache").upsert({
      tenant_id: tenantId,
      cache_key: "locations",
      data: locations,
      cached_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,cache_key" });

    return NextResponse.json({ locations });
  } catch (err: unknown) {
    // On rate limit, return cached data even if stale
    if (cached) {
      console.error("QBO locations rate limited, returning stale cache");
      return NextResponse.json({ locations: cached.data, fromCache: true, stale: true });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("QBO locations error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
