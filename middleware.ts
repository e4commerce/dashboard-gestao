import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authConfig } from "./auth.config";

// Use the edge-compatible auth (no Node.js-only modules).
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];
const PUBLIC_PREFIXES = [
  "/api/admin",
  "/api/auth",
  "/api/cron",
  "/api/debug",
  "/api/track",
  "/api/webhooks",
  "/_next",
  "/favicon.ico",
];

const STATIC_FILE = /\.(?:png|jpe?g|gif|svg|webp|ico|avif|bmp|css|js|map|woff2?|ttf|otf|eot|txt|json|xml|pdf)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    STATIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
