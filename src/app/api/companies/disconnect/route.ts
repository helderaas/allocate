import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  const currentTenantId = req.cookies.get("tenant_id")?.value;
  if (!firmId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetTenantId } = await req.json();
  if (!targetTenantId) return NextResponse.json({ error: "targetTenantId required" }, { status: 400 });

  const db = getServiceSupabase();

  // Verify tenant belongs to firm
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("id", targetTenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear QBO tokens and mark disconnected
  await db.from("tenants").update({
    qbo_access_token: null,
    qbo_refresh_token: null,
    qbo_token_expires_at: null,
    qbo_connected: false,
  }).eq("id", targetTenantId);

  // Update Stripe: reduce active qty by 1, add archive qty by 1
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

      await stripe.subscriptions.update(firm.stripe_subscription_id, { items } as Parameters<typeof stripe.subscriptions.update>[1]);
    } catch (e) {
      console.error("Stripe update failed (non-fatal):", e);
    }
  }

  // If disconnected company was active tenant, switch to another
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
