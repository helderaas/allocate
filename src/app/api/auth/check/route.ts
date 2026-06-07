import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("sb_access_token")?.value;
  const refreshToken = req.cookies.get("sb_refresh_token")?.value;
  
  return NextResponse.json({
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken,
    accessTokenLength: accessToken?.length ?? 0,
  });
}
