import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const db = getServiceSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://allocate-blond.vercel.app";

  // Use resetPasswordForEmail with service role — this sends the email
  // AND we override the redirect to our callback
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  });

  if (error) {
    console.error("Password reset error:", error.message);
  }

  // Always return ok (don't reveal if email exists)
  return NextResponse.json({ ok: true });
}
