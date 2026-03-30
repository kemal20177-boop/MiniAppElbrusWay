import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin";
import { PaymentStatus, Plan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRouterCredits } from "@/lib/app";
import { ensureDefaultPlanConfigs, ensureReferralProgram } from "@/lib/billing";

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
      referralRewardAggregate
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
      })
    ]);

    return NextResponse.json({
      ok: true,
      stats: {
        users,
        revenue30d: Number(revenue._sum.amount || 0),
        activeSubscriptions,
        spentToday: Number(spentToday._sum.totalTokens || 0),
        realCostRub: Number(Number(realCostRub._sum.costRub || 0).toFixed(6)),
        plansCount,
        promoCodesCount,
        activePromoCodesCount,
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
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 403 });
  }
}
