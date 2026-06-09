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
    .select("id, qbo_connected")
    .eq("id", targetTenantId)
    .eq("firm_id", firmId)
    .single();

  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete all data for this tenant
  await db.from("allocation_drafts").delete().eq("tenant_id", targetTenantId);
  await db.from("allocation_rules").delete().eq("tenant_id", targetTenantId);
  await db.from("allocation_templates").delete().eq("tenant_id", targetTenantId);
  await db.from("divisions").delete().eq("tenant_id", targetTenantId);
  await db.from("tenants").delete().eq("id", targetTenantId);

  // Update Stripe: remove 1 qty from the appropriate price tier
  const { data: firm } = await db
    .from("firms")
    .select("stripe_subscription_id")
    .eq("id", firmId)
    .single();

  if (firm?.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(firm.stripe_subscription_id);
      const priceId = tenant.qbo_connected
        ? process.env.STRIPE_PRICE_ID
        : process.env.STRIPE_ARCHIVE_PRICE_ID;
      const item = sub.items.data.find(i => i.price.id === priceId);

      if (item) {
        const items: object[] = [];
        if ((item.quantity ?? 1) > 1) {
          items.push({ id: item.id, quantity: (item.quantity ?? 1) - 1 });
        } else {
          items.push({ id: item.id, deleted: true });
        }

        // Check if this was the last company — cancel subscription entirely
        const { data: remainingTenants } = await db
          .from("tenants")
          .select("id")
          .eq("firm_id", firmId);

        if (!remainingTenants?.length) {
          await stripe.subscriptions.cancel(firm.stripe_subscription_id);
        } else {
          await stripe.subscriptions.update(firm.stripe_subscription_id, { items } as Parameters<typeof stripe.subscriptions.update>[1]);
        }
      }
    } catch (e) {
      console.error("Stripe update failed (non-fatal):", e);
    }
  }

  // Switch to another tenant if this was the active one
  const res = NextResponse.json({ ok: true });
  if (currentTenantId === targetTenantId) {
    const { data: others } = await db
      .from("tenants")
      .select("id")
      .eq("firm_id", firmId)
      .limit(1);
    if (others?.[0]) {
      res.cookies.set("tenant_id", others[0].id, {
        httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/",
      });
    } else {
      res.cookies.delete("tenant_id");
    }
  }
  return res;
}
