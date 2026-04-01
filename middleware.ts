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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
