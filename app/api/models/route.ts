import { NextRequest, NextResponse } from "next/server";
import { Plan } from "@prisma/client";
import { getModels } from "@/lib/app";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { getCuratedModelSections } from "@/lib/routerai/models";

function familyFromModel(id: string, name: string) {
  const source = `${id} ${name}`.toLowerCase();
  if (source.includes("claude")) return "claude";
  if (source.includes("gemini")) return "gemini";
  if (source.includes("grok")) return "grok";
  if (source.includes("banana pro")) return "nano-banana-pro";
  if (source.includes("banana")) return "nano-banana-2";
  if (source.includes("gpt") || source.includes("openai")) return "chatgpt";
  return "auto";
}

function summaryForFamily(family: string) {
  if (family === "claude") return "Сильный вариант для длинных материалов, аккуратных формулировок и сложных разборов.";
  if (family === "gemini") return "Подходит для мультимодальных задач, файлов и визуального контента.";
  if (family === "grok") return "Быстрый вариант для коротких ответов, идей и альтернативного стиля.";
  if (family === "nano-banana-pro") return "Продвинутый выбор для выразительных и детальных изображений.";
  if (family === "nano-banana-2") return "Быстрая модель для генерации изображений и визуальных экспериментов.";
  return "Универсальный выбор для чата, идей, текста и повседневных задач.";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    const plan = user?.plan ?? Plan.FREE;
    const [models, curated] = await Promise.all([getModels(plan), getCuratedModelSections(plan)]);
    const cleaned = models.map((model) => {
      const family = familyFromModel(model.id, model.name);
      return {
        id: model.id,
        name: model.name,
        label: model.name,
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

    return NextResponse.json(
      { ok: true, data: cleaned, curated },
      {
        headers: {
          "Cache-Control": "private, max-age=120, stale-while-revalidate=600"
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
