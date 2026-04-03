import { NextRequest, NextResponse } from "next/server";
import { Plan } from "@prisma/client";
import { getModels } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { getCuratedModelSections } from "@/lib/routerai/models";

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; payload: { ok: true; data: Array<Record<string, unknown>>; curated: Awaited<ReturnType<typeof getCuratedModelSections>> } }>();

function familyFromModel(id: string, name: string) {
  const source = `${id} ${name}`.toLowerCase();
  if (source.includes("claude")) return "claude";
  if (source.includes("gemini")) return "gemini";
  if (source.includes("grok")) return "grok";
  if (source.includes("deepseek")) return "deepseek";
  if (source.includes("nano-banana-pro") || source.includes("banana pro") || source.includes("nanabananapro")) return "nano-banana-pro";
  if (source.includes("nano-banana") || source.includes("banana") || source.includes("nanobanana")) return "nano-banana-2";
  if (source.includes("gpt") || source.includes("openai")) return "chatgpt";
  return "auto";
}

function summaryForFamily(family: string) {
  if (family === "claude") return "Сильный вариант для длинных материалов, аккуратных формулировок и сложных разборов.";
  if (family === "gemini") return "Подходит для мультимодальных задач, файлов и визуального контента.";
  if (family === "grok") return "Быстрый вариант для коротких ответов, идей и альтернативного стиля.";
  if (family === "deepseek") return "Мощный и экономичный вариант для кода, анализа и сложных задач.";
  if (family === "nano-banana-2") return "Быстрый вход в генерацию изображений Google Nano Banana 2.";
  if (family === "nano-banana-pro") return "Продвинутая генерация изображений Google Nano Banana Pro.";
  return "Универсальный выбор для чата, идей, текста и повседневных задач.";
}

async function buildModelsPayload(plan: Plan) {
  const cacheKey = `models:${plan}`;
  const current = responseCache.get(cacheKey);
  if (current && current.expiresAt > Date.now()) {
    return current.payload;
  }

  const [models, curated] = await Promise.all([getModels(plan), getCuratedModelSections(plan)]);
  const cleaned = models.map((model) => {
    const family = familyFromModel(model.id, model.name);
    return {
      id: model.id,
      name: model.name,
      label: model.name,
      provider: model.provider,
      family,
      summary: summaryForFamily(family),
      badge: model.supportsImageOutput ? "Медиа" : model.supportsReasoning ? "Сильная" : "Популярная",
      featured: Boolean(model.isFeatured),
      supportsChat: model.supportsTextOutput,
      supportsImages: model.supportsImageOutput || model.supportsImages,
      supportsAudio: model.supportsAudio || model.outputModalities.includes("audio"),
      supportsVideo: model.supportsVideo,
      supportsVision: model.supportsImages || model.supportsFiles
    };
  });
  const payload = { ok: true as const, data: cleaned, curated };
  responseCache.set(cacheKey, { expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS, payload });
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const plan = user?.plan ?? Plan.FREE;
    const payload = await buildModelsPayload(plan);

    return NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control": "private, max-age=300, stale-while-revalidate=1800"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "MODELS_UNAVAILABLE", message: (error as Error).message },
      { status: 502 }
    );
  }
}
