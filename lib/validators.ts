import { z } from "zod";
import { defaultModelId } from "@/lib/site";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "developer", "tool"]),
  content: z.string().min(1)
});

export const registerSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(2).max(120),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
    referralCode: z.string().trim().min(3).max(64).optional()
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"]
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const chatSchema = z.object({
  chatId: z.string().min(1).optional(),
  model: z.string().min(3),
  messages: z.array(chatMessageSchema)
});

export const responseChatSchema = z.object({
  chatId: z.string().min(1).optional(),
  model: z.string().min(3),
  input: z.union([z.string().min(1), z.array(chatMessageSchema)])
});

export const embeddingsSchema = z.object({
  model: z.string().min(3),
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  encoding_format: z.enum(["float", "base64"]).default("float")
});

export const createChatSchema = z.object({
  model: z.string().min(3).default(defaultModelId),
  title: z.string().min(1).max(120).optional()
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(120)
});

export const paymentCreateSchema = z
  .object({
    plan: z.enum(["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"]).optional(),
    planConfigId: z.string().min(1).optional(),
    packageId: z.string().optional(),
    promoCode: z.string().trim().min(3).max(64).optional()
  })
  .refine((payload) => Boolean(payload.plan || payload.planConfigId || payload.packageId), {
    message: "Не выбран тариф или пакет"
  });

export const plategaCallbackSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().nonnegative(),
  currency: z.string().min(3),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELED", "CHARGEBACK"]),
  paymentMethod: z.number().int().nonnegative()
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  plan: z.enum(["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"]).optional(),
  billingPlanId: z.string().min(1).nullable().optional(),
  tokenBalance: z.number().int().min(0).optional(),
  tokenDelta: z.number().int().optional(),
  planExpiresAt: z.string().datetime().nullable().optional(),
  referralRewardPercentOverride: z.number().int().min(0).max(100).nullable().optional(),
  reason: z.string().min(2).max(240).optional()
});

export const adminPlanSchema = z.object({
  code: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(120),
  basePlan: z.enum(["FREE", "BASE", "PRO", "ULTRA", "BUSINESS"]),
  priceRub: z.number().int().min(0),
  tokensPerMonth: z.number().int().min(0),
  requestsPerHour: z.number().int().min(0),
  description: z.string().trim().min(2).max(500),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true)
});

export const adminPromoCodeSchema = z.object({
  code: z.string().trim().min(3).max(64),
  description: z.string().trim().max(240).nullable().optional(),
  billingPlanId: z.string().trim().min(1).nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).default(0),
  bonusTokens: z.number().int().min(0).default(0),
  referralPercent: z.number().int().min(0).max(100).nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true)
});

export const referralProgramSchema = z.object({
  isEnabled: z.boolean(),
  defaultRewardPercent: z.number().int().min(0).max(100),
  refereeBonusTokens: z.number().int().min(0)
});

export const referralRewardUpdateSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"])
});
