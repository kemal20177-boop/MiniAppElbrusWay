import { Plan, type ModelConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRouterModelCatalog, type RouterModelCatalogItem } from "@/lib/routerai";

const MODEL_SYNC_TTL_MS = 10 * 60 * 1000;

declare global {
  var __elbruswayModelSyncExpiresAt: number | undefined;
  var __elbruswayModelSyncPromise: Promise<void> | undefined;
}

function getPricePerMillion(value?: number) {
  return typeof value === "number" ? value * 1_000_000 : 0;
}

function inferMinPlan(model: RouterModelCatalogItem): Plan {
  const hasKnownTextPricing =
    typeof model.pricing?.prompt === "number" ||
    typeof model.pricing?.completion === "number";

  if (!hasKnownTextPricing) {
    return Plan.BASE;
  }

  const prompt = getPricePerMillion(model.pricing?.prompt);
  const completion = getPricePerMillion(model.pricing?.completion);
  const total = prompt + completion;

  if (total <= 120) {
    return Plan.FREE;
  }

  if (total <= 600) {
    return Plan.BASE;
  }

  if (total <= 2_000) {
    return Plan.PRO;
  }

  if (total <= 5_000) {
    return Plan.ULTRA;
  }

  return Plan.BUSINESS;
}

function inferMaxTokens(model: RouterModelCatalogItem) {
  if (!model.contextLength || model.contextLength <= 0) {
    return 4096;
  }

  return Math.min(8192, Math.max(1024, Math.floor(model.contextLength / 4)));
}

function toModelConfigCreateManyInput(model: RouterModelCatalogItem) {
  return {
    id: model.id,
    displayName: model.name,
    provider: model.provider,
    isEnabled: true,
    isFeatured: model.curatedGroups.includes("top_chat") || model.curatedGroups.includes("top_image") || model.curatedGroups.includes("top_audio"),
    featuredGroup: model.curatedGroups[0] || null,
    featuredOrder: 0,
    minPlan: inferMinPlan(model),
    markupFactor: 1,
    inputPrice: Number(model.pricing?.prompt || 0),
    outputPrice: Number(model.pricing?.completion || 0),
    maxTokens: inferMaxTokens(model),
    supportsImages: model.supportsImages,
    supportsFiles: model.supportsFiles,
    supportsAudio: model.supportsAudio || model.outputModalities.includes("audio"),
    supportsVideo: model.supportsVideo,
    supportsReasoning: model.supportsReasoning,
    supportsTools: model.supportsTools,
    supportsWebSearch: model.supportsWebSearch
  };
}

export async function syncRemoteModelConfigs(force = false) {
  const now = Date.now();
  if (!force && globalThis.__elbruswayModelSyncExpiresAt && globalThis.__elbruswayModelSyncExpiresAt > now) {
    return;
  }

  if (!globalThis.__elbruswayModelSyncPromise) {
    globalThis.__elbruswayModelSyncPromise = (async () => {
      const catalog = await getRouterModelCatalog();
      const data = catalog
        .filter((model) => model.id)
        .map(toModelConfigCreateManyInput);

      if (data.length > 0) {
        const existingModels = await prisma.modelConfig.findMany({
          where: {
            id: { in: data.map((entry) => entry.id) }
          },
          select: {
            id: true,
            markupFactor: true
          }
        });
        const existingMap = new Map(existingModels.map((entry) => [entry.id, entry]));

        await prisma.modelConfig.createMany({
          data: data.filter((entry) => !existingMap.has(entry.id)),
          skipDuplicates: true
        });

        for (const entry of data) {
          const existing = existingMap.get(entry.id);
          if (!existing || existing.markupFactor !== 1) {
            continue;
          }

          await prisma.modelConfig.update({
            where: { id: entry.id },
            data: {
              displayName: entry.displayName,
              provider: entry.provider,
              minPlan: entry.minPlan,
              inputPrice: entry.inputPrice,
              outputPrice: entry.outputPrice,
              maxTokens: entry.maxTokens,
              supportsImages: entry.supportsImages,
              supportsFiles: entry.supportsFiles,
              supportsAudio: entry.supportsAudio,
              supportsVideo: entry.supportsVideo,
              supportsReasoning: entry.supportsReasoning,
              supportsTools: entry.supportsTools,
              supportsWebSearch: entry.supportsWebSearch
            }
          });
        }
      }

      globalThis.__elbruswayModelSyncExpiresAt = Date.now() + MODEL_SYNC_TTL_MS;
    })().finally(() => {
      globalThis.__elbruswayModelSyncPromise = undefined;
    });
  }

  await globalThis.__elbruswayModelSyncPromise;
}

export async function findModelConfigById(modelId: string): Promise<ModelConfig | null> {
  await syncRemoteModelConfigs();
  return prisma.modelConfig.findUnique({
    where: { id: modelId }
  });
}
