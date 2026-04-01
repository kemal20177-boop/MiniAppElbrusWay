import "server-only";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { Plan, Role, type PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { modelCatalog } from "@/lib/site";
import { plans, type PlanId } from "@/lib/plans";
import { ensureDefaultPlanConfigs } from "@/lib/billing";

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "USER" | "ADMIN";
  plan: PlanId;
  tokenBalance: number;
  planExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionRecord = {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type ChatRecord = {
  id: string;
  userId: string;
  title: string;
  model: string;
  systemPrompt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  chatId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costRub: number;
  createdAt: string;
};

export type PaymentRecord = {
  id: string;
  userId: string;
  amount: number;
  currency: "RUB";
  tokensGranted: number;
  plan: PlanId | null;
  billingPlanId: string | null;
  promoCodeId: string | null;
  provider: "PLATEGA" | "YOOKASSA" | "MANUAL";
  providerPaymentId: string | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";
  description: string;
  createdAt: string;
  completedAt: string | null;
};

export type TransactionRecord = {
  id: string;
  userId: string;
  type: "debit" | "credit";
  tokens: number;
  description: string;
  createdAt: string;
};

export type ModelRecord = {
  id: string;
  displayName: string;
  provider: string;
  isEnabled: boolean;
  minPlan: PlanId;
  markupFactor: number;
  inputPrice: number;
  outputPrice: number;
  maxTokens: number;
  supportsImages: boolean;
  supportsWebSearch: boolean;
};

export type StoreShape = {
  users: UserRecord[];
  sessions: SessionRecord[];
  chats: ChatRecord[];
  messages: MessageRecord[];
  payments: PaymentRecord[];
  transactions: TransactionRecord[];
  models: ModelRecord[];
};

function seedModels(): ModelRecord[] {
  return modelCatalog.map((model) => ({
    id: model.id,
    displayName: model.name,
    provider: model.provider,
    isEnabled: true,
    minPlan: model.priceHint === "Free" ? "FREE" : model.priceHint === "От Base" ? "BASE" : "PRO",
    markupFactor: 2,
    inputPrice: 13,
    outputPrice: 53,
    maxTokens: 4096,
    supportsImages: model.id.includes("image") || model.id.includes("gpt"),
    supportsWebSearch: model.id.includes("gpt") || model.id.includes("deepseek")
  }));
}

function toPlan(value: string | null | undefined): Plan {
  switch (value) {
    case "BASE":
    case "PRO":
    case "ULTRA":
    case "BUSINESS":
      return value;
    default:
      return "FREE";
  }
}

function toRole(value: string | null | undefined): Role {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function toPaymentStatus(value: string | null | undefined): PaymentStatus {
  switch (value) {
    case "SUCCEEDED":
    case "FAILED":
    case "CANCELLED":
    case "REFUNDED":
      return value;
    default:
      return "PENDING";
  }
}

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: Role;
  plan: Plan;
  tokenBalance: number;
  planExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name || "",
    passwordHash: user.passwordHash || "",
    role: user.role,
    plan: user.plan,
    tokenBalance: user.tokenBalance,
    planExpiresAt: serializeDate(user.planExpiresAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function serializeSession(session: {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}): SessionRecord {
  return {
    id: session.id,
    userId: session.userId,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString()
  };
}

function serializeChat(chat: {
  id: string;
  userId: string;
  title: string;
  model: string;
  systemPrompt: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ChatRecord {
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

function serializeMessage(message: {
  id: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costRub: number;
  createdAt: Date;
}): MessageRecord {
  return {
    id: message.id,
    chatId: message.chatId,
    userId: message.userId,
    role: message.role as MessageRecord["role"],
    content: message.content,
    model: message.model,
    promptTokens: message.promptTokens,
    completionTokens: message.completionTokens,
    totalTokens: message.totalTokens,
    costRub: message.costRub,
    createdAt: message.createdAt.toISOString()
  };
}

function serializePayment(payment: {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  tokensGranted: number;
  plan: Plan | null;
  billingPlanId: string | null;
  promoCodeId: string | null;
  provider: string;
  providerPaymentId: string | null;
  status: PaymentStatus;
  description: string;
  createdAt: Date;
  completedAt: Date | null;
}): PaymentRecord {
  return {
    id: payment.id,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency as "RUB",
    tokensGranted: payment.tokensGranted,
    plan: payment.plan as PlanId | null,
    billingPlanId: payment.billingPlanId,
    promoCodeId: payment.promoCodeId,
    provider: payment.provider as PaymentRecord["provider"],
    providerPaymentId: payment.providerPaymentId,
    status: payment.status,
    description: payment.description,
    createdAt: payment.createdAt.toISOString(),
    completedAt: serializeDate(payment.completedAt)
  };
}

function serializeTransaction(transaction: {
  id: string;
  userId: string;
  type: string;
  tokens: number;
  description: string;
  createdAt: Date;
}): TransactionRecord {
  return {
    id: transaction.id,
    userId: transaction.userId,
    type: transaction.type as TransactionRecord["type"],
    tokens: transaction.tokens,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString()
  };
}

function serializeModel(model: {
  id: string;
  displayName: string;
  provider: string;
  isEnabled: boolean;
  minPlan: Plan;
  markupFactor: number;
  inputPrice: number;
  outputPrice: number;
  maxTokens: number;
  supportsImages: boolean;
  supportsWebSearch: boolean;
}): ModelRecord {
  return {
    id: model.id,
    displayName: model.displayName,
    provider: model.provider,
    isEnabled: model.isEnabled,
    minPlan: model.minPlan,
    markupFactor: model.markupFactor,
    inputPrice: model.inputPrice,
    outputPrice: model.outputPrice,
    maxTokens: model.maxTokens,
    supportsImages: model.supportsImages,
    supportsWebSearch: model.supportsWebSearch
  };
}

let bootstrapPromise: Promise<void> | null = null;
let bootstrapped = false;

async function ensureAdminUser() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@elbrusway.ru").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin12345!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        passwordHash,
        role: "ADMIN",
        plan: "BUSINESS",
        tokenBalance: plans.BUSINESS.tokensPerMonth
      }
    });
    return;
  }

  if (!existing.passwordHash || existing.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role: "ADMIN",
        plan: existing.plan || "BUSINESS"
      }
    });
  }
}

async function ensureModelConfigs() {
  const count = await prisma.modelConfig.count();
  if (count > 0) {
    return;
  }

  await prisma.modelConfig.createMany({
    data: seedModels().map((model) => ({
      id: model.id,
      displayName: model.displayName,
      provider: model.provider,
      isEnabled: model.isEnabled,
      minPlan: toPlan(model.minPlan),
      markupFactor: model.markupFactor,
      inputPrice: model.inputPrice,
      outputPrice: model.outputPrice,
      maxTokens: model.maxTokens,
      supportsImages: model.supportsImages,
      supportsWebSearch: model.supportsWebSearch
    })),
    skipDuplicates: true
  });
}

export async function ensureStore() {
  if (bootstrapped) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureAdminUser();
      await ensureDefaultPlanConfigs();
      await ensureModelConfigs();
      bootstrapped = true;
    })().finally(() => {
      bootstrapPromise = null;
    });
  }

  await bootstrapPromise;
}

export async function readStore(): Promise<StoreShape> {
  await ensureStore();

  const [users, sessions, chats, messages, payments, transactions, models] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.session.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.chat.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.message.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.transaction.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.modelConfig.findMany({ orderBy: { displayName: "asc" } })
  ]);

  return {
    users: users.map(serializeUser),
    sessions: sessions.map(serializeSession),
    chats: chats.map(serializeChat),
    messages: messages.map(serializeMessage),
    payments: payments.map(serializePayment),
    transactions: transactions.map(serializeTransaction),
    models: models.map(serializeModel)
  };
}

export async function writeStore() {
  throw new Error("writeStore is not supported after Prisma migration");
}

export async function updateStore<T>() {
  throw new Error("updateStore is not supported after Prisma migration");
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId() {
  return randomUUID();
}

export async function createSessionRecord(userId: string, token: string, expiresAt: Date) {
  await ensureStore();
  return prisma.session.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });
}

export async function deleteSessionByToken(token: string) {
  await ensureStore();
  await prisma.session.deleteMany({ where: { token } });
}

export async function findSessionWithUser(token: string) {
  await ensureStore();
  return prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });
}
