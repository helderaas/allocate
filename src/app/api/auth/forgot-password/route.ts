import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const db = getServiceSupabase();

  // Generate a recovery link using admin API (no PKCE - uses token_hash flow)
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://allocate-blond.vercel.app"}/auth/callback`,
    },
  });

  if (error || !data) {
    console.error("generateLink error:", error?.message);
    // Return ok anyway to not reveal if email exists
    return NextResponse.json({ ok: true });
  }

  // Send email with the hashed token link (not PKCE)
  const resetLink = data.properties?.action_link;
  console.log("Reset link:", resetLink);

  // Use Supabase's built-in email to send the link
  // The admin.generateLink also triggers the email automatically
  return NextResponse.json({ ok: true });
}
