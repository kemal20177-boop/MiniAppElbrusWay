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
      sort: request.nextUrl.searchParams.get("sort") || undefined,
      direction: request.nextUrl.searchParams.get("direction") || undefined,
      ownerId: request.nextUrl.searchParams.get("ownerId") || undefined,
      status: request.nextUrl.searchParams.get("status") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      deletedAt: null,
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.status === "archived" ? { isArchived: true } : {}),
      ...(query.status === "active" ? { isArchived: false } : {}),
      ...(query.query
        ? {
            OR: [
              { title: { contains: query.query, mode: "insensitive" as const } },
              { description: { contains: query.query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const orderBy = { [query.sort || "updatedAt"]: query.direction };
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          _count: {
            select: {
              chats: true,
              files: true,
              documents: true,
              canvasDocs: true,
              searchSessions: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.project.count({ where })
    ]);

    return apiSuccess({ projects }, undefined, buildPaginationMeta({ page, pageSize, total }));
  } catch (error) {
    return apiError("ADMIN_PROJECTS_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
