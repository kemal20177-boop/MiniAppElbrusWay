import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { apiError, apiSuccess, buildPaginationMeta, resolveErrorMessage } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { adminListQuerySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const query = adminListQuerySchema.parse({
      page: request.nextUrl.searchParams.get("page") || undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") || undefined,
      query: request.nextUrl.searchParams.get("query") || undefined,
      userId: request.nextUrl.searchParams.get("userId") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      ...(query.userId ? { actorUserId: query.userId } : {}),
      ...(query.query
        ? {
            OR: [
              { action: { contains: query.query, mode: "insensitive" as const } },
              { entityType: { contains: query.query, mode: "insensitive" as const } },
              { entityId: { contains: query.query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actorUser: { select: { id: true, email: true, name: true } },
          targetUser: { select: { id: true, email: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.auditLog.count({ where })
    ]);

    return apiSuccess({ logs }, undefined, buildPaginationMeta({ page, pageSize, total }));
  } catch (error) {
    return apiError("ADMIN_AUDIT_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
