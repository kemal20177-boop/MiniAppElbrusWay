import { Plan, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { plans, tokenPackages, type PlanId } from "@/lib/plans";

const referralProgramId = "default";

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase();
}

export function generateReferralCode(seed: string) {
  return seed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10) || `EW${Date.now().toString(36).toUpperCase()}`;
}

export async function ensureReferralProgram() {
  return prisma.referralProgram.upsert({
    where: { id: referralProgramId },
    update: {},
    create: {
      id: referralProgramId,
      isEnabled: true,
      defaultRewardPercent: 10,
      refereeBonusTokens: 0
    }
  });
}

export async function ensureDefaultPlanConfigs() {
  const existing = await prisma.planConfig.count();
  if (existing > 0) {
    await ensureReferralProgram();
    return;
  }

  await prisma.planConfig.createMany({
    data: (Object.entries(plans) as Array<[PlanId, (typeof plans)[PlanId]]>).map(([id, plan], index) => ({
      code: id,
      name: plan.name,
      basePlan: id as Plan,
      priceRub: plan.priceRub,
      tokensPerMonth: plan.tokensPerMonth,
      requestsPerHour: plan.requestsPerHour,
      description: plan.description,
      features: [],
      sortOrder: index,
      isActive: true,
      isPublic: true
    })),
    skipDuplicates: true
  });

  await ensureReferralProgram();
}

export async function getPublicPlanConfigs() {
  await ensureDefaultPlanConfigs();
  return prisma.planConfig.findMany({
    where: {
      isActive: true,
      isPublic: true
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export async function resolveBillingPlanSelection(input: { plan?: PlanId; planConfigId?: string; packageId?: string }) {
  if (input.planConfigId) {
    const planConfig = await prisma.planConfig.findUnique({
      where: { id: input.planConfigId }
    });

    if (!planConfig || !planConfig.isActive) {
      throw new Error("PLAN_CONFIG_NOT_FOUND");
    }

    return {
      kind: "plan" as const,
      billingPlan: planConfig,
      amount: planConfig.priceRub,
      tokens: planConfig.tokensPerMonth,
      basePlan: planConfig.basePlan,
      description: `Подписка ${planConfig.name}`
    };
  }

  if (input.plan) {
    const basePlan = plans[input.plan];
    if (!basePlan) {
      throw new Error("PLAN_NOT_FOUND");
    }

    return {
      kind: "plan" as const,
      billingPlan: null,
      amount: basePlan.priceRub,
      tokens: basePlan.tokensPerMonth,
      basePlan: input.plan as Plan,
      description: `Подписка ${basePlan.name}`
    };
  }

  if (input.packageId) {
    const pack = tokenPackages.find((entry) => entry.id === input.packageId);
    if (!pack) {
      throw new Error("TOKEN_PACKAGE_NOT_FOUND");
    }

    return {
      kind: "package" as const,
      billingPlan: null,
      amount: pack.priceRub,
      tokens: pack.tokens,
      basePlan: null,
      description: `Пакет ${pack.name}`
    };
  }

  throw new Error("PAYMENT_TARGET_REQUIRED");
}

export async function resolvePromoCode(params: { userId?: string; promoCode?: string | null; billingPlanId?: string | null }) {
  if (!params.promoCode) {
    return null;
  }

  const code = normalizeReferralCode(params.promoCode);
  const promo = await prisma.promoCode.findUnique({
    where: { code }
  });

  if (!promo || !promo.isActive) {
    throw new Error("PROMO_CODE_NOT_FOUND");
  }

  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    throw new Error("PROMO_CODE_EXPIRED");
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw new Error("PROMO_CODE_EXHAUSTED");
  }

  if (promo.billingPlanId && promo.billingPlanId !== params.billingPlanId) {
    throw new Error("PROMO_CODE_PLAN_MISMATCH");
  }

  if (params.userId) {
    const alreadyUsed = await prisma.promoCodeUsage.findFirst({
      where: {
        promoCodeId: promo.id,
        userId: params.userId
      }
    });

    if (alreadyUsed) {
      throw new Error("PROMO_CODE_ALREADY_USED");
    }
  }

  return promo;
}

export function applyPromoCodeToAmount(amount: number, promo: { discountPercent: number; bonusTokens: number } | null) {
  if (!promo) {
    return {
      finalAmount: amount,
      bonusTokens: 0
    };
  }

  const discounted = Math.max(0, amount - Math.floor((amount * promo.discountPercent) / 100));
  return {
    finalAmount: discounted,
    bonusTokens: promo.bonusTokens
  };
}

export async function buildReferralContext(userId: string) {
  await ensureReferralProgram();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      referralCode: true,
      referredById: true,
      referralRewardPercentOverride: true
    }
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (!user.referralCode) {
    const referralCode = generateReferralCode(user.id);
    return prisma.user.update({
      where: { id: userId },
      data: { referralCode },
      select: {
        id: true,
        referralCode: true,
        referredById: true,
        referralRewardPercentOverride: true
      }
    });
  }

  return user;
}

export async function resolveReferrerByCode(code?: string | null) {
  if (!code) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      referralCode: normalizeReferralCode(code)
    }
  });
}

export async function createReferralRewardForPayment(params: {
  userId: string;
  paymentId: string;
  paymentAmount: number;
  promoReferralPercent?: number | null;
}) {
  await ensureReferralProgram();

  const [user, referralProgram] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        referredById: true
      }
    }),
    prisma.referralProgram.findUnique({
      where: { id: referralProgramId }
    })
  ]);

  if (!user?.referredById || !referralProgram?.isEnabled) {
    return null;
  }

  const referrer = await prisma.user.findUnique({
    where: { id: user.referredById },
    select: {
      id: true,
      referralRewardPercentOverride: true
    }
  });

  if (!referrer) {
    return null;
  }

  const rewardPercent =
    params.promoReferralPercent ?? referrer.referralRewardPercentOverride ?? referralProgram.defaultRewardPercent;
  const amountRub = Math.max(0, Math.floor((params.paymentAmount * rewardPercent) / 100));

  return prisma.referralReward.create({
    data: {
      referrerId: referrer.id,
      refereeId: params.userId,
      paymentId: params.paymentId,
      rewardPercent,
      amountRub,
      status: "APPROVED"
    }
  });
}

export async function getReferralDashboard() {
  await ensureReferralProgram();

  const [program, rewards, topReferrers] = await Promise.all([
    prisma.referralProgram.findUniqueOrThrow({
      where: { id: referralProgramId }
    }),
    prisma.referralReward.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        referrer: { select: { id: true, email: true, name: true, referralCode: true, referralRewardPercentOverride: true } },
        referee: { select: { id: true, email: true, name: true } },
        payment: { select: { id: true, amount: true, status: true, createdAt: true } }
      }
    }),
    prisma.referralReward.groupBy({
      by: ["referrerId"],
      _sum: { amountRub: true },
      _count: { _all: true },
      orderBy: {
        _sum: { amountRub: "desc" }
      },
      take: 20
    })
  ]);

  const referrerIds = topReferrers.map((entry) => entry.referrerId);
  const users = referrerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, email: true, name: true, referralCode: true, referralRewardPercentOverride: true }
      })
    : [];
  const userMap = new Map(users.map((entry) => [entry.id, entry]));

  return {
    program,
    rewards,
    topReferrers: topReferrers.map((entry) => ({
      referrer: userMap.get(entry.referrerId) || null,
      rewardsCount: entry._count._all,
      amountRub: entry._sum.amountRub || 0
    }))
  };
}

export async function getUserReferralStats(userId: string) {
  const user = await buildReferralContext(userId);
  const [referralsCount, rewards, referralProgram, recentReferrals, recentRewards] = await Promise.all([
    prisma.user.count({
      where: { referredById: userId }
    }),
    prisma.referralReward.aggregate({
      where: { referrerId: userId },
      _sum: { amountRub: true },
      _count: { _all: true }
    }),
    prisma.referralProgram.findUnique({
      where: { id: referralProgramId }
    }),
    prisma.user.findMany({
      where: { referredById: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    }),
    prisma.referralReward.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        referee: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true
          }
        }
      }
    })
  ]);

  return {
    referralCode: user.referralCode,
    referredById: user.referredById,
    referralsCount,
    rewardsCount: rewards._count._all,
    rewardAmountRub: rewards._sum.amountRub || 0,
    rewardPercent: user.referralRewardPercentOverride ?? referralProgram?.defaultRewardPercent ?? 0,
    refereeBonusTokens: referralProgram?.refereeBonusTokens ?? 0,
    recentReferrals: recentReferrals.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString()
    })),
    recentRewards: recentRewards.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      payment: entry.payment
        ? {
            ...entry.payment,
            createdAt: entry.payment.createdAt.toISOString()
          }
        : null
    }))
  };
}

export function toFeatureList(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

export async function getPaymentQuote(input: {
  userId?: string;
  plan?: PlanId;
  planConfigId?: string;
  packageId?: string;
  promoCode?: string | null;
}) {
  const selection = await resolveBillingPlanSelection(input);
  const promoCode = await resolvePromoCode({
    userId: input.userId || "",
    promoCode: input.promoCode,
    billingPlanId: selection.billingPlan?.id || null
  });
  const promoEffect = applyPromoCodeToAmount(selection.amount, promoCode);

  return {
    targetId: selection.kind === "plan" ? selection.billingPlan?.id || selection.basePlan : input.packageId || "",
    type: selection.kind,
    promoCode: promoCode
      ? {
          code: promoCode.code,
          discountPercent: promoCode.discountPercent,
          bonusTokens: promoCode.bonusTokens,
          referralPercent: promoCode.referralPercent
        }
      : null,
    baseAmount: selection.amount,
    finalAmount: promoEffect.finalAmount,
    discountAmount: Math.max(0, selection.amount - promoEffect.finalAmount),
    baseTokens: selection.tokens,
    finalTokens: selection.tokens + promoEffect.bonusTokens,
    bonusTokens: promoEffect.bonusTokens
  };
}
