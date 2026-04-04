import { Plan, type ModelConfig, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findModelConfigById } from "@/lib/model-config";

const planRank: Record<Plan, number> = {
  FREE: 0,
  BASE: 1,
  PRO: 2,
  ULTRA: 3,
  BUSINESS: 4
};

const planMaxCompletionTokens: Record<Plan, number> = {
  FREE: 2048,
  BASE: 4096,
  PRO: 8192,
  ULTRA: 16384,
  BUSINESS: 32768
};

const FREE_DAILY_TOKENS = 50_000;

function estimatePromptTokens(messages: Array<{ content: string }>) {
  const characters = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.max(1, Math.ceil(characters / 2));
}

function parseLimit(name: string) {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isPlanAllowed(plan: Plan, minPlan: Plan) {
  return planRank[plan] >= planRank[minPlan];
}

export function getPlanCompletionLimit(plan: Plan) {
  return planMaxCompletionTokens[plan];
}

export async function ensureFreePlanDailyTokens(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, tokenBalance: true, freeTokenResetAt: true }
  });

  if (!user || user.plan !== "FREE") return;

  const now = new Date();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const lastReset = user.freeTokenResetAt;
  const needsReset = !lastReset || lastReset < todayStart;

  if (needsReset) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenBalance: FREE_DAILY_TOKENS,
        freeTokenResetAt: now
      }
    });
  }
}

export async function getAllowedModelConfig(
  user: Pick<User, "id" | "plan">,
  modelId: string
) {
  const modelConfig = await findModelConfigById(modelId);

  if (!modelConfig || !modelConfig.isEnabled) {
    throw new Error("MODEL_NOT_AVAILABLE");
  }

  if (!isPlanAllowed(user.plan, modelConfig.minPlan)) {
    throw new Error("PLAN_MODEL_FORBIDDEN");
  }

  return modelConfig;
}

export async function enforceRouterPolicy(params: {
  user: Pick<User, "id" | "plan" | "tokenBalance">;
  modelConfig: Pick<ModelConfig, "id" | "inputPrice" | "outputPrice" | "maxTokens">;
  messages: Array<{ content: string }>;
}) {
  if (params.user.plan === "FREE") {
    await ensureFreePlanDailyTokens(params.user.id);
    const freshUser = await prisma.user.findUnique({
      where: { id: params.user.id },
      select: { tokenBalance: true }
    });
    if (freshUser) {
      params.user.tokenBalance = freshUser.tokenBalance;
    }
  }

  const promptTokensEstimate = estimatePromptTokens(params.messages);
  const safeMaxTokens = Math.max(1024, params.modelConfig.maxTokens || 4096);
  const maxCompletionTokens = Math.min(
    getPlanCompletionLimit(params.user.plan),
    safeMaxTokens
  );

  const estimatedTotalTokens = promptTokensEstimate + maxCompletionTokens;

  const estimatedCostRub = Number(
    (
      promptTokensEstimate * (params.modelConfig.inputPrice || 0) +
      maxCompletionTokens * (params.modelConfig.outputPrice || 0)
    ).toFixed(6)
  );

  if (params.user.tokenBalance < estimatedTotalTokens) {
    throw new Error("TOKEN_BALANCE_PRECHECK_FAILED");
  }

  const perRequestLimit = parseLimit("SPENDING_LIMIT_RUB_PER_REQUEST");
  if (perRequestLimit !== null && estimatedCostRub > perRequestLimit) {
    throw new Error("SPENDING_LIMIT_PER_REQUEST_EXCEEDED");
  }

  const userDailyLimit = parseLimit("SPENDING_LIMIT_RUB_PER_USER_PER_DAY");
  if (userDailyLimit !== null) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const aggregate = await prisma.message.aggregate({
      where: { userId: params.user.id, createdAt: { gte: dayStart } },
      _sum: { costRub: true }
    });
    const spentToday = Number(aggregate._sum.costRub || 0);
    if (spentToday + estimatedCostRub > userDailyLimit) {
      throw new Error("SPENDING_LIMIT_USER_DAILY_EXCEEDED");
    }
  }

  const globalDailyLimit = parseLimit("SPENDING_LIMIT_RUB_PER_DAY");
  if (globalDailyLimit !== null) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const aggregate = await prisma.message.aggregate({
      where: { createdAt: { gte: dayStart } },
      _sum: { costRub: true }
    });
    const spentToday = Number(aggregate._sum.costRub || 0);
    if (spentToday + estimatedCostRub > globalDailyLimit) {
      throw new Error("SPENDING_LIMIT_GLOBAL_DAILY_EXCEEDED");
    }
  }

  return {
    promptTokensEstimate,
    maxCompletionTokens,
    estimatedTotalTokens,
    estimatedCostRub
  };
}
