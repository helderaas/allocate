import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetTenantId } = await req.json();
  if (!targetTenantId) return NextResponse.json({ error: "targetTenantId required" }, { status: 400 });

  const db = getServiceSupabase();

  // Verify tenant belongs to firm and is disconnected
  const { data: tenant } = await db
    .from("tenants")
    .select("id, qbo_connected")
    .eq("id", targetTenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build QBO OAuth URL, encoding the tenantId in state so callback knows which tenant to update
  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");
  url.searchParams.set("state", `reconnect_${targetTenantId}`);

  return NextResponse.json({ url: url.toString() });
}
