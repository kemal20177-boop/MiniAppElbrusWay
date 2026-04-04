import { NextResponse, type NextRequest } from "next/server";

const sessionCookieName = "elbrusway_session";

const protectedPrefixes = [
  "/chat",
  "/projects",
  "/files",
  "/documents",
  "/canvas",
  "/tools",
  "/profile",
  "/settings",
  "/admin"
];

const authPages = ["/auth/login", "/auth/register"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const allowOrigin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "*";
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (allowOrigin !== "*") {
      headers["Access-Control-Allow-Credentials"] = "true";
    }

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers
      });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthPage = authPages.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (!sessionToken && isProtected) {
    const url = new URL("/auth/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"]
};
