import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const intuitSub = req.cookies.get("intuit_sub")?.value;

  if (!intuitSub) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const db = getServiceSupabase();

  // Look up user by intuit_sub
  const { data: intuitUser } = await db
    .from("intuit_users")
    .select("user_id, firm_id")
    .eq("intuit_sub", intuitSub)
    .single();

  if (!intuitUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get most recent active tenant
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", intuitUser.firm_id)
    .eq("qbo_connected", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

  response.cookies.set("user_id", intuitUser.user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("sb_access_token", intuitUser.user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set("firm_id", intuitUser.firm_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });

  if (tenant) {
    response.cookies.set("tenant_id", tenant.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
  }

  return response;
}
