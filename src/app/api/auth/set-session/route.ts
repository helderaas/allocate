import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { access_token, refresh_token } = await req.json();

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  
  response.cookies.set("sb_access_token", access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour for reset flow
    path: "/",
  });
  response.cookies.set("sb_refresh_token", refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });

  return response;
}
