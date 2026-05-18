import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE_NAME = "zacx_admin_session";

function isProtectedRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const expectedSession = process.env.ADMIN_SESSION_SECRET;

  const isLoggedIn =
    Boolean(expectedSession) && sessionCookie === expectedSession;

  if (isProtectedRoute(pathname) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"],
};