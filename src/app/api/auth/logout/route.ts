import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("sb_access_token");
  response.cookies.delete("sb_refresh_token");
  response.cookies.delete("tenant_id");
  response.cookies.delete("firm_id");
  response.cookies.delete("user_id");
  response.cookies.delete("intuit_sub");
  return response;
}
