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
      status: request.nextUrl.searchParams.get("status") || undefined,
      projectId: request.nextUrl.searchParams.get("projectId") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      deletedAt: null,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.projectId
        ? {
            projectLinks: {
              some: {
                projectId: query.projectId
              }
            }
          }
        : {}),
      ...(query.query
        ? {
            OR: [
              { title: { contains: query.query, mode: "insensitive" as const } },
              { summary: { contains: query.query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const orderBy = { [query.sort || "updatedAt"]: query.direction };
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          versions: {
            orderBy: { version: "desc" },
            take: 1
          },
          exports: {
            orderBy: { createdAt: "desc" }
          },
          projectLinks: {
            include: {
              project: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.document.count({ where })
    ]);

    return apiSuccess({ documents }, undefined, buildPaginationMeta({ page, pageSize, total }));
  } catch (error) {
    return apiError("ADMIN_DOCUMENTS_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
