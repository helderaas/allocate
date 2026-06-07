import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { fetchGLBalances, fetchRevenueSplit } from "@/lib/qbo-client";
import { calculateAllocationLines } from "@/lib/allocation-engine";

export async function POST(req: NextRequest) {
  const tenantId = req.cookies.get("tenant_id")?.value;
  if (!tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId, period, startDate, endDate, jeDate, description, journalNumber } = await req.json();

  const db = getServiceSupabase();

  const { data: template } = await db
    .from("allocation_templates")
    .select("*")
    .eq("id", templateId)
    .eq("tenant_id", tenantId)
    .single();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const rules = typeof template.rules === "string"
    ? JSON.parse(template.rules)
    : template.rules;
  if (!rules?.length) return NextResponse.json({ error: "Template has no rules" }, { status: 400 });

  const accountIds = rules.map((r: { qbo_account_id: string }) => r.qbo_account_id);

  // Same GL-based approach as run/route.ts
  const [glBalances, revenueSplit] = await Promise.all([
    fetchGLBalances(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate,
      accountIds,
      tenant.division_a_location_id,
      tenant.division_b_location_id
    ),
    fetchRevenueSplit(
      tenant.id, tenant.qbo_realm_id,
      tenant.qbo_access_token, tenant.qbo_refresh_token,
      startDate, endDate,
      tenant.division_a_location_id,
      tenant.division_b_location_id
    ),
  ]);

  const lines = calculateAllocationLines(rules, glBalances, revenueSplit);

  const totalDebits = lines.reduce((sum, l) => sum + l.division_a_amount + l.division_b_amount, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.untagged_amount, 0);

  await db.from("allocation_drafts").delete()
    .eq("tenant_id", tenantId)
    .eq("period", period);

  const { data: draft, error } = await db
    .from("allocation_drafts")
    .insert({
      tenant_id: tenantId,
      period,
      status: "draft",
      lines: JSON.stringify(lines),
      total_debits: totalDebits,
      total_credits: totalCredits,
      je_date: jeDate || endDate,
      description: description || `${template.name} - ${period}`,
      journal_number: journalNumber,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft });
}
