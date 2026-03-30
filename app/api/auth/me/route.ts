import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, sanitizeUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: sanitizeUser(user) });
}
