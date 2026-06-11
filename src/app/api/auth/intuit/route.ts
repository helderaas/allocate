import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const realmId = searchParams.get("realmId"); // passed for returning users to skip company select

  // Validate returnTo to prevent open redirect
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";

  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");

  if (realmId) {
    // Returning user — include realmId to bypass company select screen
    url.searchParams.set("realmId", realmId);
    url.searchParams.set("state", "sso_" + Buffer.from(safeReturnTo).toString("base64"));
  } else {
    // New user — show company select
    url.searchParams.set("state", "sso_" + Buffer.from(safeReturnTo).toString("base64"));
  }

  return NextResponse.redirect(url.toString());
}
