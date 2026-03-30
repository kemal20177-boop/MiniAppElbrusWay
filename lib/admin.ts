import { NextRequest } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function requireAdminUser(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user || user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  return user;
}
