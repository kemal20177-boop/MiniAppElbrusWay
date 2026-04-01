import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { JobStatus, PaymentStatus, Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRouterCredits } from "@/lib/app";
import { ensureDefaultPlanConfigs, ensureReferralProgram } from "@/lib/billing";
import { apiError, apiSuccess, resolveErrorMessage } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    await Promise.all([ensureDefaultPlanConfigs(), ensureReferralProgram()]);

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    const [
      users,
      revenue,
      activeSubscriptions,
      spentToday,
      realCostRub,
      routerCreditsResult,
      plansCount,
      promoCodesCount,
      activePromoCodesCount,
      referralProgram,
      referralRewardAggregate,
      filesCount,
      documentsCount,
      projectsCount,
      storageAggregate,
      searchRuns,
      exportsCount,
      failedJobsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true }
      }),
      prisma.user.count({
        where: { plan: { not: Plan.FREE } }
      }),
      prisma.message.aggregate({
        where: { createdAt: { gte: dayStart } },
        _sum: { totalTokens: true }
      }),
      prisma.message.aggregate({
        _sum: { costRub: true }
      }),
      getRouterCredits().catch((error) => ({ error: (error as Error).message })),
      prisma.planConfig.count(),
      prisma.promoCode.count(),
      prisma.promoCode.count({ where: { isActive: true } }),
      prisma.referralProgram.findUnique({ where: { id: "default" } }),
      prisma.referralReward.aggregate({
        _sum: { amountRub: true },
        _count: { _all: true }
      }),
      prisma.userFile.count({ where: { deletedAt: null } }),
      prisma.document.count({ where: { deletedAt: null } }),
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.userFile.aggregate({ where: { deletedAt: null }, _sum: { sizeBytes: true } }),
      prisma.searchSession.count(),
      prisma.documentExport.count(),
      prisma.apiJob.count({ where: { status: JobStatus.FAILED } })
    ]);

    return apiSuccess({
      stats: {
        users,
        revenue30d: Number(revenue._sum.amount || 0),
        activeSubscriptions,
        spentToday: Number(spentToday._sum.totalTokens || 0),
        realCostRub: Number(Number(realCostRub._sum.costRub || 0).toFixed(6)),
        plansCount,
        promoCodesCount,
        activePromoCodesCount,
        filesCount,
        documentsCount,
        projectsCount,
        storageBytes: Number(storageAggregate._sum.sizeBytes || 0),
        searchRuns,
        exportsCount,
        failedJobsCount,
        referralRewardsCount: referralRewardAggregate._count._all,
        referralRewardsRub: referralRewardAggregate._sum.amountRub || 0,
        referralProgram,
        routerCredits:
          "credits" in routerCreditsResult && typeof routerCreditsResult.credits === "number"
            ? routerCreditsResult.credits
            : null,
        routerCreditsError: "error" in routerCreditsResult ? routerCreditsResult.error : null
      }
    });
  } catch (error) {
    return apiError("ADMIN_STATS_FORBIDDEN", resolveErrorMessage(error, "FORBIDDEN"), 403);
  }
}
