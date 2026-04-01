import { NextRequest } from "next/server";
import { FileKind, FileStatus } from "@prisma/client";
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
      kind: request.nextUrl.searchParams.get("kind") || undefined,
      userId: request.nextUrl.searchParams.get("userId") || undefined
    });
    const page = query.page;
    const pageSize = query.pageSize;
    const where = {
      deletedAt: null,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.kind ? { kind: query.kind as FileKind } : {}),
      ...(query.status ? { status: query.status as FileStatus } : {}),
      ...(query.query
        ? {
            OR: [
              { originalName: { contains: query.query, mode: "insensitive" as const } },
              { extractedText: { contains: query.query, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const orderBy = { [query.sort || "createdAt"]: query.direction };
    const [files, total, storageTotals] = await Promise.all([
      prisma.userFile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          },
          _count: {
            select: {
              chunks: true,
              projectFiles: true,
              chatAttachments: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.userFile.count({ where }),
      prisma.userFile.aggregate({
        where: { deletedAt: null },
        _sum: { sizeBytes: true }
      })
    ]);

    return apiSuccess(
      {
        files,
        storageBytes: Number(storageTotals._sum.sizeBytes || 0)
      },
      undefined,
      buildPaginationMeta({ page, pageSize, total })
    );
  } catch (error) {
    return apiError("ADMIN_FILES_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
