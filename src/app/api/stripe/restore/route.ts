import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const firmId = session.metadata?.firm_id;

    if (!firmId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const db = getServiceSupabase();

    // Get the firm's owner user
    const { data: firm } = await db
      .from("firms")
      .select("owner_user_id")
      .eq("id", firmId)
      .single();

    if (!firm) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // Get the most recent tenant for this firm
    const { data: tenant } = await db
      .from("tenants")
      .select("id")
      .eq("firm_id", firmId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Re-set all session cookies
    const response = NextResponse.redirect(new URL("/dashboard", req.url));

    response.cookies.set("user_id", firm.owner_user_id, {
      httpOnly: true, secure: true, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    response.cookies.set("sb_access_token", firm.owner_user_id, {
      httpOnly: true, secure: true, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, path: "/",
    });
    response.cookies.set("firm_id", firmId, {
      httpOnly: true, secure: true, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, path: "/",
    });
    if (tenant) {
      response.cookies.set("tenant_id", tenant.id, {
        httpOnly: true, secure: true, sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, path: "/",
      });
    }

    return response;
  } catch (err) {
    console.error("Session restore error:", err);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
