import { NextRequest } from "next/server";
import { getCurrentUserFromRequest, sanitizeUser } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return apiError("UNAUTHORIZED", "Требуется авторизация", 401);
  }

  return apiSuccess({ user: sanitizeUser(user) });
}
