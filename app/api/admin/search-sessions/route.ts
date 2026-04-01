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
      projectId: request.nextUrl.searchParams.get("projectId") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.query
        ? {
            OR: [
              { query: { contains: query.query, mode: "insensitive" as const } },
              { answer: { contains: query.query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [sessions, total] = await Promise.all([
      prisma.searchSession.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          project: { select: { id: true, title: true } },
          sources: { orderBy: { position: "asc" }, take: 5 }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.searchSession.count({ where })
    ]);

    return apiSuccess({ sessions }, undefined, buildPaginationMeta({ page, pageSize, total }));
  } catch (error) {
    return apiError("ADMIN_SEARCH_SESSIONS_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
