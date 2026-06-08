import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const firmId = req.cookies.get("firm_id")?.value;
  if (!firmId) return NextResponse.json({ subscription: null });

  const db = getServiceSupabase();
  const { data: firm } = await db
    .from("firms")
    .select("subscription_status, subscription_quantity, subscription_current_period_end, stripe_customer_id")
    .eq("id", firmId)
    .single();

  return NextResponse.json({ subscription: firm ?? null });
}
