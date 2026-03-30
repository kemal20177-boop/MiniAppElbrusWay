import {
  createRouterCompletion,
  createRouterCompletionStream,
  createRouterEmbedding,
  createRouterResponse,
  fetchRouterCredits,
  getRouterModelCatalog,
  getModelPricingMap,
  type RouterMessage,
  type RouterResponsesInput
} from "@/lib/routerai";
import { getPlanExpiry, plans, tokenPackages, type PlanId } from "@/lib/plans";
import { makeId, nowIso, type PaymentRecord, type UserRecord, ensureStore } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { enforceRouterPolicy, getAllowedModelConfig } from "@/lib/routerai-policy";
import { isPlanAllowed } from "@/lib/routerai-policy";
import { syncRemoteModelConfigs } from "@/lib/model-config";
import { Plan } from "@prisma/client";
import {
  createPlategaTransaction,
  fetchPlategaTransactionStatus,
  isPlategaConfigured,
  type PlategaPaymentStatus
} from "@/lib/platega";
import {
  applyPromoCodeToAmount,
  createReferralRewardForPayment,
  resolveBillingPlanSelection,
  resolvePromoCode
} from "@/lib/billing";

export async function getModels(plan: Plan = Plan.FREE) {
  const [catalog] = await Promise.all([getRouterModelCatalog(), syncRemoteModelConfigs()]);
  const configs = await prisma.modelConfig.findMany({
    where: { isEnabled: true }
  });
  const configMap = new Map(configs.map((entry) => [entry.id, entry]));

  return catalog.filter((model) => {
    const config = configMap.get(model.id);
    return Boolean(config && isPlanAllowed(plan, config.minPlan));
  });
}

export async function ensureUserCanSpend(userId: string) {
  await ensureStore();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  if (user.tokenBalance <= 0) {
    throw new Error("TOKENS_EXHAUSTED");
  }

  return user;
}

export async function createChatForUser(userId: string, model: string, title = "Новый чат") {
  await ensureStore();
  const chat = await prisma.chat.create({
    data: {
      userId,
      title,
      model,
      systemPrompt: null,
      isArchived: false
    }
  });

  return {
    id: chat.id,
    userId: chat.userId,
    title: chat.title,
    model: chat.model,
    systemPrompt: chat.systemPrompt,
    isArchived: chat.isArchived,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString()
  };
}

function getLastUserMessage(messages: Array<{ role: string; content: string }>) {
  return [...messages].reverse().find((entry) => entry.role === "user");
}

export async function persistChatCompletion(params: {
  userId: string;
  chatId?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costRub: number;
}) {
  let chatId = params.chatId;

  if (!chatId) {
    const firstUserMessage = getLastUserMessage(params.messages)?.content || "Новый чат";
    const chat = await createChatForUser(params.userId, params.model, firstUserMessage.slice(0, 48));
    chatId = chat.id;
  }

  const lastUserMessage = getLastUserMessage(params.messages);

  return prisma.$transaction(async (tx) => {
    const chat = await tx.chat.findFirst({
      where: { id: chatId, userId: params.userId }
    });
    if (!chat) {
      throw new Error("CHAT_NOT_FOUND");
    }

    const timestamp = new Date();
    const currentUser = await tx.user.findUnique({
      where: { id: params.userId },
      select: { tokenBalance: true }
    });

    if (!currentUser || currentUser.tokenBalance < params.totalTokens) {
      throw new Error("TOKENS_EXHAUSTED");
    }

    if (lastUserMessage) {
      await tx.message.create({
        data: {
          chatId: chat.id,
          userId: params.userId,
          role: "user",
          content: lastUserMessage.content,
          model: params.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costRub: 0,
          createdAt: timestamp
        }
      });
    }

    await tx.message.create({
      data: {
        chatId: chat.id,
        userId: params.userId,
        role: "assistant",
        content: params.content,
        model: params.model,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        costRub: params.costRub,
        createdAt: timestamp
      }
    });

    const persistedUser = await tx.user.update({
      where: { id: params.userId },
      data: {
        tokenBalance: {
          decrement: params.totalTokens
        }
      }
    });

    await tx.transaction.create({
      data: {
        userId: params.userId,
        type: "debit",
        tokens: params.totalTokens,
        description: `Списание токенов за модель ${params.model}`,
        createdAt: timestamp
      }
    });

    await tx.chat.update({
      where: { id: chat.id },
      data: {
        updatedAt: timestamp,
        model: params.model,
        ...(lastUserMessage && chat.title === "Новый чат" ? { title: lastUserMessage.content.slice(0, 48) } : {})
      }
    });

    return {
      chatId: chat.id,
      content: params.content,
      usage: {
        prompt_tokens: params.promptTokens,
        completion_tokens: params.completionTokens,
        total_tokens: params.totalTokens
      },
      tokenBalance: Math.max(0, persistedUser.tokenBalance),
      costRub: params.costRub
    };
  });
}

export async function prepareChatCompletion(params: {
  user: UserRecord;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
}) {
  const user = await ensureUserCanSpend(params.user.id);
  const modelConfig = await getAllowedModelConfig(user, params.model);
  const policy = await enforceRouterPolicy({
    user,
    modelConfig,
    messages: params.messages
  });

  return { user, modelConfig, policy };
}

export async function calculateChatCostRub(params: {
  model: string;
  inputPrice: number;
  outputPrice: number;
  promptTokens: number;
  completionTokens: number;
}) {
  const modelPricing = getModelPricingMap(await getModels()).get(params.model);
  const promptUnitCost = Number(modelPricing?.prompt ?? params.inputPrice ?? 0);
  const completionUnitCost = Number(modelPricing?.completion ?? params.outputPrice ?? 0);
  return Number((params.promptTokens * promptUnitCost + params.completionTokens * completionUnitCost).toFixed(6));
}

export async function completeChat(params: {
  user: UserRecord;
  chatId?: string;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
}) {
  const { user, modelConfig, policy } = await prepareChatCompletion({
    user: params.user,
    model: params.model,
    messages: params.messages
  });
  const completion = await createRouterCompletion(params.model, params.messages as RouterMessage[], {
    maxTokens: policy.maxCompletionTokens
  });
  const content = String(completion.choices?.[0]?.message?.content || "");
  const promptTokens = Number(completion.usage?.prompt_tokens || 0);
  const completionTokens = Number(completion.usage?.completion_tokens || 0);
  const totalTokens = Number(completion.usage?.total_tokens || promptTokens + completionTokens);
  const costRub = await calculateChatCostRub({
    model: params.model,
    inputPrice: modelConfig.inputPrice,
    outputPrice: modelConfig.outputPrice,
    promptTokens,
    completionTokens
  });
  return persistChatCompletion({
    userId: params.user.id,
    chatId: params.chatId,
    model: params.model,
    messages: params.messages,
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    costRub
  });
}

function extractResponseText(output: Array<Record<string, unknown>> | undefined) {
  if (!Array.isArray(output)) {
    return "";
  }

  for (const item of output) {
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }

    const text = content
      .map((chunk) => {
        if (!chunk || typeof chunk !== "object") {
          return "";
        }

        if (typeof (chunk as { text?: unknown }).text === "string") {
          return (chunk as { text: string }).text;
        }

        return "";
      })
      .filter(Boolean)
      .join("");

    if (text) {
      return text;
    }
  }

  return "";
}

export async function completeChatViaResponses(params: {
  user: UserRecord;
  chatId?: string;
  model: string;
  input: RouterResponsesInput;
}) {
  const inputMessages =
    typeof params.input === "string"
      ? ([{ role: "user", content: params.input }] as RouterMessage[])
      : (params.input as RouterMessage[]);
  const { user, modelConfig, policy } = await prepareChatCompletion({
    user: params.user,
    model: params.model,
    messages: inputMessages as Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>
  });

  const responseEntity = await createRouterResponse(params.model, params.input, {
    maxOutputTokens: policy.maxCompletionTokens
  });
  const content = extractResponseText(responseEntity.output);
  const promptTokens = Number(responseEntity.usage?.input_tokens || 0);
  const completionTokens = Number(responseEntity.usage?.output_tokens || 0);
  const totalTokens = Number(responseEntity.usage?.total_tokens || promptTokens + completionTokens);
  const costRub = await calculateChatCostRub({
    model: params.model,
    inputPrice: modelConfig.inputPrice,
    outputPrice: modelConfig.outputPrice,
    promptTokens,
    completionTokens
  });

  return persistChatCompletion({
    userId: params.user.id,
    chatId: params.chatId,
    model: params.model,
    messages: inputMessages,
    content,
    promptTokens,
    completionTokens,
    totalTokens,
    costRub
  });
}

export async function getRouterCredits() {
  return fetchRouterCredits();
}

export async function createEmbeddings(params: {
  user: UserRecord;
  model: string;
  input: string | string[];
  encodingFormat?: "float" | "base64";
}) {
  await ensureUserCanSpend(params.user.id);
  return createRouterEmbedding({
    model: params.model,
    input: params.input,
    encodingFormat: params.encodingFormat
  });
}

export async function createChatStream(params: {
  user: UserRecord;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
}) {
  const prepared = await prepareChatCompletion(params);
  const response = await createRouterCompletionStream(params.model, params.messages as RouterMessage[], {
    maxTokens: prepared.policy.maxCompletionTokens
  });

  return { ...prepared, response };
}

function mapPlategaStatus(status: PlategaPaymentStatus) {
  switch (status) {
    case "CONFIRMED":
      return "SUCCEEDED" as const;
    case "CANCELED":
      return "CANCELLED" as const;
    case "CHARGEBACK":
      return "REFUNDED" as const;
    default:
      return "PENDING" as const;
  }
}

async function markPaymentSucceeded(params: { paymentId: string; completedAt?: Date }) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        promoCode: true
      }
    });

    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    if (payment.status === "SUCCEEDED") {
      return payment;
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        completedAt: params.completedAt || new Date()
      }
    });

    await tx.user.update({
      where: { id: payment.userId },
      data: {
        tokenBalance: {
          increment: payment.tokensGranted
        },
        ...(payment.plan
          ? {
              plan: payment.plan,
              billingPlanId: payment.billingPlanId || null,
              planExpiresAt: new Date(getPlanExpiry(1))
            }
          : {})
      }
    });

    await tx.transaction.create({
      data: {
        userId: payment.userId,
        type: "credit",
        tokens: payment.tokensGranted,
        description: payment.description,
        createdAt: params.completedAt || new Date()
      }
    });

    if (payment.promoCodeId) {
      await tx.promoCode.update({
        where: { id: payment.promoCodeId },
        data: {
          usedCount: {
            increment: 1
          }
        }
      });

      await tx.promoCodeUsage.create({
        data: {
          promoCodeId: payment.promoCodeId,
          userId: payment.userId,
          paymentId: payment.id
        }
      });
    }

    const updatedPayment = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id }
    });

    return updatedPayment;
  });
}

async function markPaymentTerminalStatus(params: {
  paymentId: string;
  status: "CANCELLED" | "FAILED" | "REFUNDED";
  completedAt?: Date;
}) {
  return prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      status: params.status,
      completedAt: params.completedAt || new Date()
    }
  });
}

export async function createPayment(userId: string, input: {
  plan?: PlanId;
  planConfigId?: string;
  packageId?: string;
  promoCode?: string;
}) {
  const timestamp = nowIso();
  const paymentId = makeId();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://elbrusway.ru";
  const selection = await resolveBillingPlanSelection(input);
  const promoCode = await resolvePromoCode({
    userId,
    promoCode: input.promoCode,
    billingPlanId: selection.billingPlan?.id || null
  });
  const promoEffect = applyPromoCodeToAmount(selection.amount, promoCode);
  const amount = promoEffect.finalAmount;
  const tokens = selection.tokens + promoEffect.bonusTokens;
  const planId = selection.basePlan;
  const description = promoCode ? `${selection.description} · промокод ${promoCode.code}` : selection.description;
  const requiresExternalPayment = amount > 0;

  if (requiresExternalPayment && !isPlategaConfigured()) {
    throw new Error("PLATEGA_CONFIG_MISSING");
  }

  const payment: PaymentRecord = {
    id: paymentId,
    userId,
    amount,
    currency: "RUB",
    tokensGranted: tokens,
    plan: (planId as PlanId | null) || null,
    billingPlanId: selection.billingPlan?.id || null,
    promoCodeId: promoCode?.id || null,
    provider: requiresExternalPayment ? "PLATEGA" : "MANUAL",
    providerPaymentId: null,
    status: requiresExternalPayment ? "PENDING" : "SUCCEEDED",
    description,
    createdAt: timestamp,
    completedAt: requiresExternalPayment ? null : timestamp
  };

  let confirmationUrl = `${appUrl}${payment.status === "SUCCEEDED" ? "/payment/success" : "/payment/fail"}?paymentId=${payment.id}`;

  if (requiresExternalPayment) {
    const plategaTransaction = await createPlategaTransaction({
      paymentMethod: Number(process.env.PLATEGA_PAYMENT_METHOD || 2),
      paymentDetails: {
        amount,
        currency: "RUB"
      },
      description,
      return: `${appUrl}/payment/success?paymentId=${payment.id}`,
      failedUrl: `${appUrl}/payment/fail?paymentId=${payment.id}`,
      payload: payment.id
    });

    payment.providerPaymentId = plategaTransaction.transactionId;
    confirmationUrl = plategaTransaction.redirect;
  }

  await ensureStore();
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        id: payment.id,
        userId,
        amount: payment.amount,
        currency: payment.currency,
        tokensGranted: payment.tokensGranted,
        plan: payment.plan,
        billingPlanId: payment.billingPlanId,
        promoCodeId: payment.promoCodeId,
        provider: payment.provider,
        providerPaymentId: payment.providerPaymentId,
        status: payment.status,
        description: payment.description,
        createdAt: new Date(payment.createdAt),
        completedAt: payment.completedAt ? new Date(payment.completedAt) : null
      }
    });

    if (payment.status === "SUCCEEDED") {
      await tx.user.update({
        where: { id: userId },
        data: {
          tokenBalance: {
            increment: tokens
          },
          ...(planId
            ? {
              plan: planId,
              billingPlanId: selection.billingPlan?.id || null,
              planExpiresAt: new Date(getPlanExpiry(1))
            }
            : {})
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "credit",
          tokens,
          description: payment.description,
          createdAt: new Date(timestamp)
        }
      });

      if (promoCode) {
        await tx.promoCode.update({
          where: { id: promoCode.id },
          data: {
            usedCount: {
              increment: 1
            }
          }
        });

        await tx.promoCodeUsage.create({
          data: {
            promoCodeId: promoCode.id,
            userId,
            paymentId: payment.id
          }
        });
      }
    }
  });

  if (payment.status === "SUCCEEDED") {
    await createReferralRewardForPayment({
      userId,
      paymentId: payment.id,
      paymentAmount: payment.amount,
      promoReferralPercent: promoCode?.referralPercent ?? null
    });
  }

  return { payment, confirmationUrl };
}

export async function getPaymentStatusForUser(userId: string, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId }
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (payment.provider === "PLATEGA" && payment.providerPaymentId && payment.status === "PENDING") {
    const providerStatus = await fetchPlategaTransactionStatus(payment.providerPaymentId);
    return syncPaymentStatus(payment.providerPaymentId, providerStatus.status);
  }

  return payment;
}

export async function syncPaymentStatus(providerPaymentId: string, providerStatus: PlategaPaymentStatus) {
  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId }
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  const targetStatus = mapPlategaStatus(providerStatus);
  if (payment.status === "SUCCEEDED" && targetStatus !== "REFUNDED") {
    return payment;
  }

  if (targetStatus === "SUCCEEDED") {
    const updatedPayment = await markPaymentSucceeded({ paymentId: payment.id });
    await createReferralRewardForPayment({
      userId: updatedPayment.userId,
      paymentId: updatedPayment.id,
      paymentAmount: updatedPayment.amount
    });
    return updatedPayment;
  }

  if (targetStatus === "CANCELLED" || targetStatus === "REFUNDED") {
    return markPaymentTerminalStatus({
      paymentId: payment.id,
      status: targetStatus
    });
  }

  return payment;
}
