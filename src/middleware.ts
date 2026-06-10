import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/disconnect",
  "/connect-type",
  "/privacy",
  "/terms",
  "/blog",
  "/auth",
  "/api/auth",
  "/api/stripe/webhook",
  "/subscription",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + "/")
  );
  if (isPublic) return NextResponse.next();

  const accessToken = req.cookies.get("sb_access_token")?.value;

  if (!accessToken) {
    const loginUrl = new URL("/login", req.url);
    // Validate returnTo — only allow relative paths to prevent open redirect
    const safeReturnTo = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
    loginUrl.searchParams.set("returnTo", safeReturnTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
