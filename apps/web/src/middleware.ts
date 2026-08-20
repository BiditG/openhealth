import { NextRequest, NextResponse } from "next/server";
import { defaultLocale } from "@/lib/i18n-config";

const PUBLIC_PATHS = ["/", "/learn", "/blog", "/docs", "/privacy", "/pricing", "/support"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en/, "") || "/";
    return NextResponse.redirect(url);
  }

  const response = isPublicPath(pathname)
    ? NextResponse.rewrite(new URL(`/${defaultLocale}${pathname}`, request.url))
    : NextResponse.next();

  response.headers.set("x-locale", defaultLocale);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|api|manifest\\.json|icons|sw\\.js|icon\\.svg|robots\\.txt|sitemap\\.xml|.*\\..*).*)",
  ],
};
