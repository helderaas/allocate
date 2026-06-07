import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (!code) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const db = getServiceSupabase();
    
    // Exchange the code for a session
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    
    if (error || !data.session) {
      return NextResponse.redirect(new URL("/login?error=invalid_reset_link", req.url));
    }

    // Set auth cookies so the reset password page works
    const response = NextResponse.redirect(new URL(next, req.url));
    response.cookies.set("sb_access_token", data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour — short lived for security
      path: "/",
    });
    response.cookies.set("sb_refresh_token", data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=invalid_reset_link", req.url));
  }
}
