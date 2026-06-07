import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.some(route =>
    pathname === route || pathname.startsWith(route + "/")
  );
  if (isPublic) return NextResponse.next();

  // Check for our simple session cookie
  const accessToken = req.cookies.get("sb_access_token")?.value;

  if (!accessToken) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

