import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceSupabase } from "@/lib/supabase";
import { QBOTokens } from "@/types";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.redirect(new URL("/dashboard?error=missing_params", req.url));
  }

  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          },
        },
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString("base64");

    const { data: tokens } = await axios.post<QBOTokens>(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QBO_REDIRECT_URI!,
      }).toString(),
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const db = getServiceSupabase();
    const { data: tenant, error } = await db
      .from("tenants")
      .upsert({
        qbo_realm_id: realmId,
        user_id: user.id,
        qbo_access_token: tokens.access_token,
        qbo_refresh_token: tokens.refresh_token,
        qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }, { onConflict: "qbo_realm_id" })
      .select()
      .single();

    if (error) throw error;

    const { data: rules } = await db
      .from("allocation_rules")
      .select("id")
      .eq("tenant_id", tenant.id)
      .limit(1);

    const isSetupComplete =
      !!tenant.division_a_location_id &&
      !!tenant.division_b_location_id &&
      (rules?.length ?? 0) > 0;

    const redirectPath = isSetupComplete ? "/dashboard" : `/onboarding?tenantId=${tenant.id}`;

    const response = NextResponse.redirect(new URL(redirectPath, req.url));
    response.cookies.set("tenant_id", tenant.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("QBO OAuth callback error:", err);
    return NextResponse.redirect(new URL("/dashboard?error=qbo_auth_failed", req.url));
  }
}


// v2

