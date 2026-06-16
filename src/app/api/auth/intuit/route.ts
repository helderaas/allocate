import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const returning = searchParams.get("returning") === "true";
  const realmId = searchParams.get("realmId");

  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";

  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", process.env.NEXT_PUBLIC_QBO_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_QBO_REDIRECT_URI ?? "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "com.intuit.quickbooks.accounting openid profile email");

  // Pass realmId so Intuit skips the company picker for returning users
  if (realmId) {
    url.searchParams.set("realmId", realmId);
  }

  // Encode both returnTo and returning flag in state
  const stateData = JSON.stringify({ returnTo: safeReturnTo, returning });
  url.searchParams.set("state", "sso_" + Buffer.from(stateData).toString("base64"));

  return NextResponse.redirect(url.toString());
}
