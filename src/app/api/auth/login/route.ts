import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const db = getServiceSupabase();

  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  // Set auth cookies
  response.cookies.set("sb_access_token", data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.cookies.set("sb_refresh_token", data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  // Look up tenant for this user and set tenant_id cookie
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("user_id", data.user.id)
    .single();

  if (tenant) {
    response.cookies.set("tenant_id", tenant.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }

  return response;
}
