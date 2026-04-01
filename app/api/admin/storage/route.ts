import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const [byKind, byStatus, totals] = await Promise.all([
      prisma.userFile.groupBy({
        by: ["kind"],
        where: { deletedAt: null },
        _count: { _all: true },
        _sum: { sizeBytes: true }
      }),
      prisma.apiJob.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.userFile.aggregate({
        where: { deletedAt: null },
        _sum: { sizeBytes: true }
      })
    ]);

    return apiSuccess({
      totalStorageBytes: Number(totals._sum.sizeBytes || 0),
      filesByKind: byKind.map((entry) => ({
        kind: entry.kind,
        count: entry._count._all,
        sizeBytes: Number(entry._sum.sizeBytes || 0)
      })),
      jobsByStatus: byStatus.map((entry) => ({
        status: entry.status,
        count: entry._count._all
      }))
    });
  } catch (error) {
    return apiError("ADMIN_STORAGE_FORBIDDEN", resolveErrorMessage(error), 403);
  }
}
