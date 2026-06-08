import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const db = getServiceSupabase();

  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  // Set auth cookies
  response.cookies.set("sb_access_token", data.session.access_token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/",
  });
  response.cookies.set("sb_refresh_token", data.session.refresh_token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
  });

  // Find or create firm for this user
  let firm = null;
  const { data: existingFirm } = await db
    .from("firms")
    .select("id")
    .eq("owner_user_id", data.user.id)
    .single();

  if (existingFirm) {
    firm = existingFirm;
  } else {
    // Create firm for existing users who don't have one yet
    const { data: newFirm } = await db
      .from("firms")
      .insert({ name: email, owner_user_id: data.user.id })
      .select("id")
      .single();
    firm = newFirm;

    // Link any existing tenants to this firm
    if (firm) {
      await db
        .from("tenants")
        .update({ firm_id: firm.id })
        .eq("user_id", data.user.id);
    }
  }

  if (firm) {
    response.cookies.set("firm_id", firm.id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
  }

  // Look up the last active tenant for this firm
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("firm_id", firm?.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tenant) {
    response.cookies.set("tenant_id", tenant.id, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
    });
  }

  return response;
}
