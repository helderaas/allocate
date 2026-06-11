import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Clear session cookies
  response.cookies.delete("sb_access_token");
  response.cookies.delete("sb_refresh_token");
  response.cookies.delete("tenant_id");
  response.cookies.delete("firm_id");
  response.cookies.delete("user_id");
  // NOTE: intentionally keep intuit_sub cookie so returning users
  // can sign back in without going through OAuth company select
  return response;
}
