import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.get("aurelia_session")?.value === "1";
  const { pathname } = request.nextUrl;

  // Unauthenticated user trying to access /dashboard -> redirect to /login
  if (pathname.startsWith("/dashboard") && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user visiting /login or / -> redirect to /dashboard
  if ((pathname === "/login" || pathname === "/") && hasSession) {
    const dashUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashUrl);
  }

  // Root path without session -> redirect to /login
  if (pathname === "/" && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*"],
};
