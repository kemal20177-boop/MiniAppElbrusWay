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
import { createRouterChatCompletion, createRouterChatStream, type RouterChatContentPart } from "@/lib/routerai/chat";
import { toRouterContentPartForFile } from "@/lib/routerai/files";
import { buildRouterPlugins } from "@/lib/routerai/plugins";
import { getPlanExpiry, plans, tokenPackages, type PlanId } from "@/lib/plans";
import { makeId, nowIso, type PaymentRecord, type UserRecord, ensureStore } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { enforceRouterPolicy, getAllowedModelConfig } from "@/lib/routerai-policy";
import { isPlanAllowed } from "@/lib/routerai-policy";
import { Plan, Prisma } from "@prisma/client";
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
import { attachFilesToChat, buildAttachmentContext } from "@/lib/files";

type ChatToolSelection = {
  webSearch?: boolean;
  projectContext?: boolean;
  fileAnalysis?: boolean;
};

type PreparedChatContext = {
  chatId?: string;
  projectId?: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
  toolEvents: Array<{
    id: string;
    toolName: string;
    status: string;
    output: Record<string, unknown>;
  }>;
};

const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
const modelsByPlanCache = new Map<Plan, { expiresAt: number; data: Awaited<ReturnType<typeof getRouterModelCatalog>> }>();

export async function getModels(plan: Plan = Plan.FREE) {
  const cached = modelsByPlanCache.get(plan);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const catalog = await getRouterModelCatalog();
  const configs = await prisma.modelConfig.findMany({
    where: { isEnabled: true }
  });
  const configMap = new Map(configs.map((entry) => [entry.id, entry]));

  const data = catalog.filter((model) => {
    const config = configMap.get(model.id);
    return Boolean(config && isPlanAllowed(plan, config.minPlan));
  });
  modelsByPlanCache.set(plan, { expiresAt: Date.now() + MODELS_CACHE_TTL_MS, data });
  return data;
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

async function syncChatProjectLink(params: { userId: string; chatId: string; projectId?: string | null }) {
  if (!params.projectId) {
    return;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      ownerId: params.userId,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  await prisma.projectChatLink.upsert({
    where: {
      projectId_chatId: {
        projectId: params.projectId,
        chatId: params.chatId
      }
    },
    update: {},
    create: {
      projectId: params.projectId,
      chatId: params.chatId,
      userId: params.userId
    }
  });
}

export async function createChatForUser(userId: string, model: string, title = "Новый чат", projectId?: string) {
  await ensureStore();
  const chat = await prisma.chat.create({
    data: {
      userId,
      title,
      model,
      projectId: projectId || null,
      systemPrompt: null,
      isArchived: false
    }
  });

  await syncChatProjectLink({
    userId,
    chatId: chat.id,
    projectId
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

async function resolveChatOwnership(params: {
  userId: string;
  chatId?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  projectId?: string;
}) {
  if (params.chatId) {
    const existing = await prisma.chat.findFirst({
      where: {
        id: params.chatId,
        userId: params.userId
      }
    });

    if (!existing) {
      throw new Error("CHAT_NOT_FOUND");
    }

    if (params.projectId && existing.projectId !== params.projectId) {
      await prisma.chat.update({
        where: { id: existing.id },
        data: { projectId: params.projectId }
      });
      await syncChatProjectLink({
        userId: params.userId,
        chatId: existing.id,
        projectId: params.projectId
      });
    }

    return {
      id: existing.id,
      projectId: params.projectId || existing.projectId || undefined
    };
  }

  const firstUserMessage = getLastUserMessage(params.messages)?.content || "Новый чат";
  const created = await createChatForUser(
    params.userId,
    params.model,
    firstUserMessage.slice(0, 48),
    params.projectId
  );

  return {
    id: created.id,
    projectId: params.projectId
  };
}

async function buildProjectContext(userId: string, projectId?: string) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: userId,
      deletedAt: null
    },
    include: {
      instructions: {
        where: { isEnabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 8
      },
      files: {
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          file: {
            select: {
              id: true,
              originalName: true,
              kind: true,
              extractedText: true
            }
          }
        }
      },
      documents: {
        take: 4,
        orderBy: { createdAt: "desc" },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              summary: true
            }
          }
        }
      }
    }
  });

  if (!project) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const instructions = project.instructions.map((entry) => `- ${entry.title}: ${entry.content}`).join("\n");
  const files = project.files
    .map((entry) => {
      const excerpt = entry.file.extractedText?.slice(0, 500) || "";
      return `- ${entry.file.originalName} (${entry.file.kind})${excerpt ? `: ${excerpt}` : ""}`;
    })
    .join("\n");
  const documents = project.documents
    .map((entry) => `- ${entry.document.title}${entry.document.summary ? `: ${entry.document.summary}` : ""}`)
    .join("\n");

  return {
    project,
    summary: [
      `Проект: ${project.title}`,
      project.description ? `Описание: ${project.description}` : null,
      instructions ? `Инструкции:\n${instructions}` : null,
      files ? `Файлы:\n${files}` : null,
      documents ? `Документы:\n${documents}` : null
    ]
      .filter(Boolean)
      .join("\n\n")
  };
}

async function createToolEvent(params: {
  chatId: string;
  userId: string;
  toolName: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
}) {
  const toolCall = await prisma.chatToolCall.create({
    data: {
      chatId: params.chatId,
      userId: params.userId,
      toolName: params.toolName,
      toolStatus: params.errorMessage ? "FAILED" : "SUCCEEDED",
      input: (params.input || undefined) as Prisma.InputJsonValue | undefined,
      output: (params.output || undefined) as Prisma.InputJsonValue | undefined,
      errorMessage: params.errorMessage || null,
      completedAt: new Date()
    }
  });

  return {
    id: toolCall.id,
    toolName: toolCall.toolName,
    status: toolCall.toolStatus,
    output: (toolCall.output || {}) as Record<string, unknown>
  };
}

async function prepareChatRuntimeContext(params: {
  userId: string;
  chatId?: string;
  projectId?: string;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
  attachmentIds?: string[];
  tools?: ChatToolSelection;
}) {
  const chat = await resolveChatOwnership({
    userId: params.userId,
    chatId: params.chatId,
    model: params.model,
    messages: params.messages,
    projectId: params.projectId
  });

  const toolEvents: PreparedChatContext["toolEvents"] = [];
  const augmentedMessages = [...params.messages];
  const attachmentIds = params.attachmentIds || [];

  if (attachmentIds.length > 0) {
    const attachments = await buildAttachmentContext(params.userId, attachmentIds);
    const attachmentContext = attachments
      .map((file) => `Файл ${file.name} (${file.kind}): ${file.summary}${file.excerpt ? `\n${file.excerpt}` : ""}`)
      .join("\n\n");

    augmentedMessages.unshift({
      role: "developer",
      content: `Контекст вложений:\n${attachmentContext}`
    });

    toolEvents.push(
      await createToolEvent({
        chatId: chat.id,
        userId: params.userId,
        toolName: "file_context",
        input: { attachmentIds },
        output: {
          files: attachments.map((file) => ({
            id: file.id,
            name: file.name,
            kind: file.kind
          }))
        }
      })
    );
  }

  if (params.tools?.projectContext && chat.projectId) {
    const projectContext = await buildProjectContext(params.userId, chat.projectId);
    if (projectContext?.summary) {
      augmentedMessages.unshift({
        role: "developer",
        content: `Контекст проекта:\n${projectContext.summary}`
      });

      toolEvents.push(
        await createToolEvent({
          chatId: chat.id,
          userId: params.userId,
          toolName: "project_context",
          input: { projectId: chat.projectId },
          output: {
            projectId: chat.projectId,
            title: projectContext.project.title
          }
        })
      );
    }
  }

  if (params.tools?.webSearch) {
    const lastUserMessage = getLastUserMessage(params.messages);
    if (lastUserMessage?.content) {
      toolEvents.push(
        await createToolEvent({
          chatId: chat.id,
          userId: params.userId,
          toolName: "routerai_web_plugin",
          input: { query: lastUserMessage.content },
          output: {
            mode: "routerai-plugin",
            query: lastUserMessage.content
          }
        })
      );
    }
  }

  return {
    chatId: chat.id,
    projectId: chat.projectId,
    messages: augmentedMessages,
    toolEvents
  } satisfies PreparedChatContext;
}

async function toRouterMessages(params: {
  userId: string;
  messages: PreparedChatContext["messages"];
  attachmentIds?: string[];
}) {
  const routerMessages: RouterMessage[] = params.messages.map((message) => ({
    role: message.role,
    content: message.content
  }));

  const lastUserIndex = [...routerMessages].map((entry, index) => ({ entry, index })).reverse().find((entry) => entry.entry.role === "user")?.index;
  if (lastUserIndex == null || !(params.attachmentIds || []).length) {
    return routerMessages;
  }

  const message = routerMessages[lastUserIndex];
  const parts: RouterChatContentPart[] = [{ type: "text", text: String(message.content || "") }];
  for (const fileId of params.attachmentIds || []) {
    parts.push(await toRouterContentPartForFile(params.userId, fileId));
  }
  routerMessages[lastUserIndex] = {
    role: message.role,
    content: parts
  };

  return routerMessages;
}

export async function persistChatCompletion(params: {
  userId: string;
  chatId?: string;
  projectId?: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  attachmentIds?: string[];
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costRub: number;
}) {
  let chatId = params.chatId;

  if (!chatId) {
    const firstUserMessage = getLastUserMessage(params.messages)?.content || "Новый чат";
    const chat = await createChatForUser(params.userId, params.model, firstUserMessage.slice(0, 48), params.projectId);
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
      const userMessage = await tx.message.create({
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

      if ((params.attachmentIds || []).length > 0) {
        await attachFilesToChat({
          userId: params.userId,
          chatId: chat.id,
          messageId: userMessage.id,
          fileIds: params.attachmentIds || []
        });
      }
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
        ...(params.projectId ? { projectId: params.projectId } : {}),
        ...(lastUserMessage && chat.title === "Новый чат" ? { title: lastUserMessage.content.slice(0, 48) } : {})
      }
    });

    if (params.projectId) {
      await syncChatProjectLink({
        userId: params.userId,
        chatId: chat.id,
        projectId: params.projectId
      });
    }

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
  projectId?: string;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
  attachmentIds?: string[];
  tools?: ChatToolSelection;
}) {
  const context = await prepareChatRuntimeContext({
    userId: params.user.id,
    chatId: params.chatId,
    projectId: params.projectId,
    model: params.model,
    messages: params.messages,
    attachmentIds: params.attachmentIds,
    tools: params.tools
  });
  const { user, modelConfig, policy } = await prepareChatCompletion({
    user: params.user,
    model: params.model,
    messages: context.messages
  });
  const routerMessages = await toRouterMessages({
    userId: params.user.id,
    messages: context.messages,
    attachmentIds: params.attachmentIds
  });
  const plugins = buildRouterPlugins({
    web: Boolean(params.tools?.webSearch && modelConfig.supportsWebSearch),
    fileParser: Boolean((params.attachmentIds || []).length && modelConfig.supportsTools)
  });
  const completion = await createRouterChatCompletion({
    userId: params.user.id,
    projectId: context.projectId,
    chatId: context.chatId,
    model: params.model,
    messages: routerMessages,
    maxTokens: policy.maxCompletionTokens,
    plugins,
    ...(params.tools?.webSearch && modelConfig.supportsWebSearch ? { webSearchOptions: { search_context_size: "medium" } } : {})
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
    chatId: context.chatId,
    projectId: context.projectId,
    model: params.model,
    messages: params.messages,
    attachmentIds: params.attachmentIds,
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

function flattenRouterMessageContent(content: string | RouterChatContentPart[]) {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "file") return `[file:${part.file.filename}]`;
      if (part.type === "image_url") return "[image]";
      if (part.type === "video_url") return "[video]";
      if (part.type === "input_audio") return "[audio]";
      return "";
    })
    .join("\n");
}

export async function completeChatViaResponses(params: {
  user: UserRecord;
  chatId?: string;
  projectId?: string;
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
    projectId: params.projectId,
    model: params.model,
    messages: inputMessages.map((entry) => ({ role: entry.role, content: flattenRouterMessageContent(entry.content) })),
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
  chatId?: string;
  projectId?: string;
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system" | "developer" | "tool"; content: string }>;
  attachmentIds?: string[];
  tools?: ChatToolSelection;
}) {
  const context = await prepareChatRuntimeContext({
    userId: params.user.id,
    chatId: params.chatId,
    projectId: params.projectId,
    model: params.model,
    messages: params.messages,
    attachmentIds: params.attachmentIds,
    tools: params.tools
  });
  const prepared = await prepareChatCompletion({
    user: params.user,
    model: params.model,
    messages: context.messages
  });
  const routerMessages = await toRouterMessages({
    userId: params.user.id,
    messages: context.messages,
    attachmentIds: params.attachmentIds
  });
  const plugins = buildRouterPlugins({
    web: Boolean(params.tools?.webSearch && prepared.modelConfig.supportsWebSearch),
    fileParser: Boolean((params.attachmentIds || []).length && prepared.modelConfig.supportsTools)
  });
  const { response } = await createRouterChatStream({
    userId: params.user.id,
    projectId: context.projectId,
    chatId: context.chatId,
    model: params.model,
    messages: routerMessages,
    maxTokens: prepared.policy.maxCompletionTokens,
    plugins,
    ...(params.tools?.webSearch && prepared.modelConfig.supportsWebSearch ? { webSearchOptions: { search_context_size: "medium" } } : {})
  });

  return { ...prepared, response, chatId: context.chatId, projectId: context.projectId, toolEvents: context.toolEvents };
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
