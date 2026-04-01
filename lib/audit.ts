import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditPayload = {
  action: string;
  actorId?: string | null;
  targetUserId?: string | null;
  entityType?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
};

function readRequestContext() {
  try {
    const requestHeaders = headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    const realIp = requestHeaders.get("x-real-ip");

    return {
      ipAddress: realIp || forwardedFor?.split(",")[0]?.trim() || null,
      userAgent: requestHeaders.get("user-agent") || null
    };
  } catch {
    return {
      ipAddress: null,
      userAgent: null
    };
  }
}

export async function writeAuditLog(payload: AuditPayload) {
  const requestContext = readRequestContext();

  await prisma.auditLog.create({
    data: {
      actorUserId: payload.actorId || null,
      targetUserId: payload.targetUserId || null,
      action: payload.action,
      entityType: payload.entityType || null,
      entityId: payload.entityId || null,
      ipAddress: payload.ipAddress ?? requestContext.ipAddress,
      userAgent: payload.userAgent ?? requestContext.userAgent,
      details: (payload.details || undefined) as Prisma.InputJsonValue | undefined
    }
  });
}
