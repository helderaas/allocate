import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const db = getServiceSupabase();

  const { data: signUpData, error: signUpError } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  // Create firm for new user
  const { data: firm } = await db
    .from("firms")
    .insert({ name: email, owner_user_id: signUpData.user.id })
    .select("id")
    .single();

  // Sign in immediately
  const { data, error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError || !data.session) {
    return NextResponse.json({ error: "Account created but sign in failed. Please sign in manually." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("sb_access_token", data.session.access_token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  response.cookies.set("sb_refresh_token", data.session.refresh_token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });
  if (firm) {
    response.cookies.set("firm_id", firm.id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
  }

  return response;
}
