import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { safeDecrypt } from "@/lib/crypto";
import axios from "axios";

async function revokeIntuitToken(refreshToken: string) {
  try {
    const credentials = Buffer.from(
      `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
    ).toString("base64");
    await axios.post(
      "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
      new URLSearchParams({ token: refreshToken }).toString(),
      { headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" } }
    );
  } catch (e) {
    console.error("Intuit token revoke failed (non-fatal):", e);
  }
}

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  const currentTenantId = req.cookies.get("tenant_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetTenantId } = await req.json();
  if (!targetTenantId) return NextResponse.json({ error: "targetTenantId required" }, { status: 400 });

  const db = getServiceSupabase();

  const { data: tenant } = await db
    .from("tenants")
    .select("id, qbo_refresh_token")
    .eq("id", targetTenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Revoke Intuit OAuth token
  if (tenant.qbo_refresh_token) {
    const plainRefreshToken = safeDecrypt(tenant.qbo_refresh_token);
    await revokeIntuitToken(plainRefreshToken);
  }

  // Clear QBO tokens and mark disconnected
  await db.from("tenants").update({
    qbo_access_token: null,
    qbo_refresh_token: null,
    qbo_token_expires_at: null,
    qbo_connected: false,
  }).eq("id", targetTenantId);

  // Update Stripe
  const { data: firm } = await db
    .from("firms")
    .select("stripe_subscription_id")
    .eq("id", firmId)
    .single();

  if (firm?.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(firm.stripe_subscription_id);
      const activeItem = sub.items.data.find(i => i.price.id === process.env.STRIPE_PRICE_ID);
      const archiveItem = sub.items.data.find(i => i.price.id === process.env.STRIPE_ARCHIVE_PRICE_ID);
      const items: object[] = [];
      if (activeItem) {
        if ((activeItem.quantity ?? 1) > 1) {
          items.push({ id: activeItem.id, quantity: (activeItem.quantity ?? 1) - 1 });
        } else {
          items.push({ id: activeItem.id, deleted: true });
        }
      }
      if (archiveItem) {
        items.push({ id: archiveItem.id, quantity: (archiveItem.quantity ?? 0) + 1 });
      } else {
        items.push({ price: process.env.STRIPE_ARCHIVE_PRICE_ID!, quantity: 1 });
      }
      if (items.length > 0) {
        await stripe.subscriptions.update(firm.stripe_subscription_id, { items } as Parameters<typeof stripe.subscriptions.update>[1]);
      }
    } catch (e) {
      console.error("Stripe update failed (non-fatal):", e);
    }
  }

  const res = NextResponse.json({ ok: true });
  if (currentTenantId === targetTenantId) {
    const { data: others } = await db
      .from("tenants")
      .select("id")
      .eq("firm_id", firmId)
      .neq("id", targetTenantId)
      .limit(1);
    if (others?.[0]) {
      res.cookies.set("tenant_id", others[0].id, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
      });
    }
  }
  return res;
}
