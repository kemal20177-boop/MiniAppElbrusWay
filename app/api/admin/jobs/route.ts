import { NextRequest } from "next/server";
import { JobStatus } from "@prisma/client";
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
      status: request.nextUrl.searchParams.get("status") || undefined,
      projectId: request.nextUrl.searchParams.get("projectId") || undefined,
      userId: request.nextUrl.searchParams.get("userId") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status as JobStatus } : {}),
      ...(query.query ? { jobType: { contains: query.query, mode: "insensitive" as const } } : {})
    };

    const [jobs, total] = await Promise.all([
      prisma.apiJob.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          project: { select: { id: true, title: true } }
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.apiJob.count({ where })
    ]);

    return apiSuccess({ jobs }, undefined, buildPaginationMeta({ page, pageSize, total }));
  } catch (error) {
    return apiError("ADMIN_JOBS_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
