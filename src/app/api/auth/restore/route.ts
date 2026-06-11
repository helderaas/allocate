import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const intuitSub = req.cookies.get("intuit_sub")?.value;
  const userId = req.cookies.get("user_id")?.value ?? req.cookies.get("sb_access_token")?.value;
  const firmId = req.cookies.get("firm_id")?.value;

  // Already have full session — go straight to dashboard
  if (userId && firmId) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Have intuit_sub — restore session from DB without OAuth
  if (intuitSub) {
    const db = getServiceSupabase();

    const { data: intuitUser } = await db
      .from("intuit_users")
      .select("user_id, firm_id")
      .eq("intuit_sub", intuitSub)
      .single();

    if (intuitUser) {
      const { data: tenant } = await db
        .from("tenants")
        .select("id")
        .eq("firm_id", intuitUser.firm_id)
        .eq("qbo_connected", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const response = NextResponse.redirect(new URL("/dashboard", req.url));
      const isProd = process.env.NODE_ENV === "production";
      const cookieOpts = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/" };

      response.cookies.set("user_id", intuitUser.user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
      response.cookies.set("sb_access_token", intuitUser.user_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
      response.cookies.set("firm_id", intuitUser.firm_id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
      if (tenant) {
        response.cookies.set("tenant_id", tenant.id, { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 });
      }
      return response;
    }
  }

  // No cookie — fall back to OAuth (returning user with cleared browser)
  // Use returnTo=dashboard so after OAuth they skip classify and go straight to dashboard
  return NextResponse.redirect(new URL("/api/auth/intuit?returnTo=/dashboard&returning=true", req.url));
}
