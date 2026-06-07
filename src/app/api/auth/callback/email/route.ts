import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Handle PKCE token hash (password recovery)
  if (tokenHash && type === "recovery") {
    try {
      const db = getServiceSupabase();
      const { data, error } = await db.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (error || !data.session) {
        return NextResponse.redirect(new URL("/login?error=invalid_reset_link", req.url));
      }

      const response = NextResponse.redirect(new URL("/reset-password", req.url));
      response.cookies.set("sb_access_token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60,
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

  // Handle authorization code (email confirmation)
  if (code) {
    try {
      const db = getServiceSupabase();
      const { data, error } = await db.auth.exchangeCodeForSession(code);

      if (error || !data.session) {
        return NextResponse.redirect(new URL("/login?error=invalid_link", req.url));
      }

      const response = NextResponse.redirect(new URL("/reset-password", req.url));
      response.cookies.set("sb_access_token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60,
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
      return NextResponse.redirect(new URL("/login?error=invalid_link", req.url));
    }
  }

  return NextResponse.redirect(new URL("/login", req.url));
}
