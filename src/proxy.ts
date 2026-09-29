import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isAuthPage =
    pathname.startsWith("/signin") || pathname.startsWith("/signup");

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/signin", req.nextUrl.origin));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon).*)",
  ],
};
