import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Log all params to help debug
  const allParams: Record<string, string> = {};
  searchParams.forEach((value, key) => { allParams[key] = value; });
  console.log("Email callback params:", JSON.stringify(allParams));

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "recovery";

  const db = getServiceSupabase();

  // Try code exchange first
  if (code) {
    try {
      const { data, error } = await db.auth.exchangeCodeForSession(code);
      console.log("Code exchange result:", error?.message ?? "success", !!data.session);
      
      if (!error && data.session) {
        return buildResponse(req, data.session.access_token, data.session.refresh_token);
      }
    } catch (e) {
      console.log("Code exchange error:", e);
    }
  }

  // Try token_hash verification
  if (tokenHash) {
    try {
      const { data, error } = await db.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "recovery" | "email",
      });
      console.log("Token hash result:", error?.message ?? "success", !!data.session);

      if (!error && data.session) {
        return buildResponse(req, data.session.access_token, data.session.refresh_token);
      }
    } catch (e) {
      console.log("Token hash error:", e);
    }
  }

  // Nothing worked — redirect with all params as query string for debugging
  const errorUrl = new URL("/login", req.url);
  errorUrl.searchParams.set("error", "invalid_link");
  errorUrl.searchParams.set("params", JSON.stringify(allParams));
  return NextResponse.redirect(errorUrl);
}

function buildResponse(req: NextRequest, accessToken: string, refreshToken: string) {
  const response = NextResponse.redirect(new URL("/reset-password", req.url));
  response.cookies.set("sb_access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
  response.cookies.set("sb_refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
  return response;
}
