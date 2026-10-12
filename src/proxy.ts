import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Only checks that a session cookie exists — a fast redirect, not a security boundary. The real session check
// (against the database) happens in the tRPC context, server actions and pages via getSession().
export default function proxy(req: NextRequest) {
  const isLoggedIn = !!getSessionCookie(req);
  const { pathname } = req.nextUrl;
  const isAuthPage =
    pathname.startsWith("/signin") || pathname.startsWith("/signup");
  // Reachable signed out, but unlike sign-in and sign-up they stay reachable when signed in too.
  const isOpenPage = ["/verify-email", "/forgot-password", "/reset-password"].some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isAuthPage && !isOpenPage) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl.origin));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon).*)",
  ],
};
