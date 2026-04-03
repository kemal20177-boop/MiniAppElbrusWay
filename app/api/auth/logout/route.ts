import { NextRequest, NextResponse } from "next/server";
import { destroySession, sessionCookieName } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

async function performLogout(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  await destroySession(token);
  await writeAuditLog({
    action: "auth.logout",
    details: {
      hadSessionToken: Boolean(token)
    }
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });

  return response;
}

export async function POST(request: NextRequest) {
  return performLogout(request);
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/auth/login", request.url));
  const token = request.cookies.get(sessionCookieName)?.value;
  await destroySession(token);
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: process.env.COOKIE_SAMESITE === "none" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/"
  });
  return response;
}
