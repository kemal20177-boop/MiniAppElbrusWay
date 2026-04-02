import { z } from "zod";
import { defaultModelId } from "@/lib/site";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "developer", "tool"]),
  content: z.string().min(1)
});

export const registerSchema = z
  .object({
    email: z.string().trim().email({ message: "Укажите корректный email" }),
    name: z.string().trim().min(2, { message: "Введите имя не короче 2 символов" }).max(120),
    password: z.string().min(8, { message: "Пароль должен содержать минимум 8 символов" }).max(128),
    confirmPassword: z.string().min(8, { message: "Пароль должен содержать минимум 8 символов" }).max(128),
    referralCode: z.string().trim().min(3).max(64).optional()
  })
  .refine((payload) => payload.password === payload.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"]
  });

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "Укажите корректный email" }),
  password: z.string().min(8, { message: "Пароль должен содержать минимум 8 символов" }).max(128)
});

export function getFirstValidationMessage(error: unknown, fallback = "Проверьте заполнение формы") {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || fallback;
  }
  return fallback;
}

export const chatSchema = z.object({
  chatId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  attachmentIds: z.array(z.string().min(1)).max(12).default([]),
  tools: z
    .object({
      webSearch: z.boolean().optional(),
      projectContext: z.boolean().optional(),
      fileAnalysis: z.boolean().optional()
    })
    .default({}),
  model: z.string().min(3),
  messages: z.array(chatMessageSchema)
});

export const responseChatSchema = z.object({
  chatId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
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
  title: z.string().min(1).max(120).optional(),
  projectId: z.string().min(1).optional()
});

export const chatListQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  pinned: z.coerce.boolean().optional(),
  archived: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const chatUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  deletedAt: z.boolean().optional()
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

export const projectCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  description: z.string().trim().max(1000).optional(),
  systemPrompt: z.string().trim().max(4000).optional(),
  color: z.string().trim().max(24).optional(),
  icon: z.string().trim().max(32).optional()
});

export const projectUpdateSchema = projectCreateSchema.extend({
  isArchived: z.boolean().optional()
});

export const fileUploadMetadataSchema = z.object({
  projectId: z.string().min(1).optional()
});

export const fileAnalyzeSchema = z.object({
  mode: z.enum(["summary", "vision", "ocr", "data", "audio", "video"]).default("summary")
});

export const fileListQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  kind: z.enum(["DOCUMENT", "IMAGE", "DATA", "AUDIO", "VIDEO", "OTHER"]).optional(),
  status: z.enum(["UPLOADING", "READY", "FAILED", "DELETED"]).optional(),
  query: z.string().trim().max(200).optional()
});

export const fileBulkActionSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1).max(50),
  action: z.enum(["delete", "attachToChat", "addToProject"]),
  chatId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional()
});

export const multiUploadSchema = z.object({
  projectId: z.string().min(1).optional(),
  files: z.array(z.object({
    name: z.string().min(1),
    size: z.number().int().positive(),
    type: z.string().min(1)
  })).min(1).max(20)
});

export const searchSessionCreateSchema = z.object({
  query: z.string().trim().min(2).max(500),
  projectId: z.string().min(1).optional(),
  chatId: z.string().min(1).optional(),
  latestOnly: z.boolean().optional(),
  depth: z.enum(["SHORT", "STANDARD", "DEEP"]).default("STANDARD"),
  sessionId: z.string().min(1).optional()
});

export const documentCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  prompt: z.string().trim().min(2).max(8000),
  projectId: z.string().min(1).optional(),
  sourceFileId: z.string().min(1).optional(),
  sourceChatId: z.string().min(1).optional(),
  template: z.enum(["proposal", "report", "spec", "faq", "resume", "presentation", "article"]).default("spec"),
  tone: z.enum(["neutral", "formal", "executive", "friendly", "technical"]).default("technical"),
  structure: z.enum(["brief", "standard", "detailed"]).default("standard"),
  length: z.enum(["short", "medium", "long"]).default("medium")
});

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  content: z.string().min(1).optional(),
  changeSummary: z.string().trim().max(400).optional(),
  sectionKey: z.string().trim().max(80).optional(),
  regenerateSummary: z.boolean().optional(),
  archived: z.boolean().optional()
});

export const documentExportSchema = z.object({
  format: z.enum(["PDF", "DOCX", "PPTX", "MD", "TXT"])
});

export const canvasCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  content: z.string().min(1),
  projectId: z.string().min(1).optional(),
  kind: z.enum(["TEXT", "MARKDOWN", "CODE", "JSON", "HTML", "SQL"]).optional(),
  language: z.string().trim().max(32).optional(),
  prompt: z.string().trim().max(4000).optional()
});

export const canvasUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  content: z.string().min(1),
  prompt: z.string().trim().max(4000).optional()
});

export const canvasRewriteSchema = z.object({
  action: z.enum(["improve", "shorten", "translate", "explain", "refactor"]),
  selection: z.string().min(1).optional(),
  prompt: z.string().trim().max(4000).optional(),
  language: z.string().trim().max(32).optional()
});

export const canvasRollbackSchema = z.object({
  version: z.number().int().min(1)
});

export const toolImageSchema = z.object({
  mode: z.enum(["text-to-image", "image-to-image"]).default("text-to-image"),
  model: z.string().min(3).optional(),
  prompt: z.string().trim().min(2).max(4000),
  sourceFileId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  style: z.string().trim().max(120).optional(),
  aspectRatio: z.enum(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]).default("1:1"),
  imageSize: z.enum(["1K", "2K", "4K"]).optional()
});

export const toolAudioSchema = z.object({
  mode: z.enum(["transcription", "tts"]),
  model: z.string().min(3).optional(),
  text: z.string().trim().max(8000).optional(),
  sourceFileId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  voice: z.string().trim().max(64).optional()
}).refine((payload) => {
  if (payload.mode === "transcription") {
    return Boolean(payload.sourceFileId);
  }

  return Boolean(payload.text);
}, { message: "Нужно выбрать аудиофайл или ввести текст" });

export const toolVideoSchema = z.object({
  mode: z.enum(["storyboard", "task"]),
  prompt: z.string().trim().min(2).max(4000),
  projectId: z.string().min(1).optional(),
  durationSec: z.number().int().min(5).max(180).default(15)
});

export const toolVisionSchema = z.object({
  mode: z.enum(["ocr", "describe", "screenshot-analysis", "chart-analysis", "ask"]),
  sourceFileId: z.string().min(1),
  question: z.string().trim().max(4000).optional(),
  projectId: z.string().min(1).optional()
});

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(64).optional(),
  direction: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().trim().max(64).optional(),
  kind: z.string().trim().max(64).optional(),
  userId: z.string().trim().max(64).optional(),
  ownerId: z.string().trim().max(64).optional(),
  projectId: z.string().trim().max(64).optional()
});
