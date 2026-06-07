import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const accessToken = req.cookies.get("sb_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getServiceSupabase();

  // Get the user from the access token
  const { data: { user }, error: userError } = await db.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 401 });
  }

  // Update the password using admin API
  const { error } = await db.auth.admin.updateUserById(user.id, { password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the short-lived reset cookies
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("sb_access_token");
  response.cookies.delete("sb_refresh_token");

  return response;
}
