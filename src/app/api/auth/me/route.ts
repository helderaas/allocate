import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    tenantId: req.cookies.get("tenant_id")?.value ?? null,
    firmId: req.cookies.get("firm_id")?.value ?? null,
  });
}
