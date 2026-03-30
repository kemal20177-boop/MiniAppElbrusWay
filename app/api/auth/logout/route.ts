import { NextRequest, NextResponse } from "next/server";
import { destroySession, sessionCookieName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;
  await destroySession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(0),
    path: "/"
  });

  return response;
}
