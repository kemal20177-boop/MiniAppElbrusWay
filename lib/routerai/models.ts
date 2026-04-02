import "server-only";
import { Plan, type ModelConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { routerAiJsonRequest } from "@/lib/routerai/client";

const MODEL_CACHE_TTL_SEC = 60 * 10;

export type RouterPricing = Partial<Record<"prompt" | "completion" | "image" | "audio" | "web_search" | "input_cache_read", number>>;

type RouterRemoteModel = {
  id: string;
  name?: string;
  pricing?: RouterPricing;
  context_length?: number;
  supported_parameters?: string[];
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
};

export type RouterModelCatalogItem = {
  id: string;
  name: string;
  provider: string;
  pricing: RouterPricing | null;
  contextLength: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsAudio: boolean;
  supportsVideo: boolean;
  supportsWebSearch: boolean;
  supportsReasoning: boolean;
  supportsTools: boolean;
  supportsTextOutput: boolean;
  supportsImageOutput: boolean;
  curatedGroups: string[];
  isEnabled?: boolean;
  isFeatured?: boolean;
  featuredGroup?: string | null;
  featuredOrder?: number;
  minPlan?: Plan;
};

export const FEATURED_GROUPS = ["top_chat", "top_image", "top_audio", "fast", "cheap", "premium", "coding", "reasoning"] as const;
export type FeaturedGroup = (typeof FEATURED_GROUPS)[number];
const planRank: Record<Plan, number> = { FREE: 0, BASE: 1, PRO: 2, ULTRA: 3, BUSINESS: 4 };

function toProviderName(modelId: string) {
  const raw = modelId.split("/")[0] || "routerai";
  return raw
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function inferCuratedGroups(model: RouterModelCatalogItem) {
  const groups = new Set<string>();
  const pricing = Number(model.pricing?.prompt || 0) + Number(model.pricing?.completion || 0);
  const id = model.id.toLowerCase();

  if (model.supportsImageOutput) groups.add("top_image");
  if (model.supportsAudio || model.outputModalities.includes("audio")) groups.add("top_audio");
  if (model.supportsTextOutput) groups.add("top_chat");
  if (pricing > 0 && pricing < 0.000001) groups.add("cheap");
  if (model.contextLength && model.contextLength <= 64000) groups.add("fast");
  if (pricing > 0.00001) groups.add("premium");
  if (id.includes("coder") || id.includes("code") || id.includes("gpt-5") || id.includes("claude")) groups.add("coding");
  if (model.supportsReasoning || id.includes("o3") || id.includes("reasoning") || id.includes("claude")) groups.add("reasoning");

  return [...groups];
}

export function normalizeRouterModel(remote: RouterRemoteModel): RouterModelCatalogItem {
  const inputModalities = remote.architecture?.input_modalities || [];
  const outputModalities = remote.architecture?.output_modalities || [];
  const supportedParameters = remote.supported_parameters || [];
  const normalized: RouterModelCatalogItem = {
    id: String(remote.id || ""),
    name: String(remote.name || remote.id || "Unknown model"),
    provider: toProviderName(String(remote.id || "")),
    pricing: remote.pricing || null,
    contextLength: typeof remote.context_length === "number" ? remote.context_length : null,
    inputModalities,
    outputModalities,
    supportsImages: inputModalities.includes("image"),
    supportsFiles: inputModalities.includes("file"),
    supportsAudio: inputModalities.includes("audio"),
    supportsVideo: inputModalities.includes("video"),
    supportsWebSearch: supportedParameters.includes("web_search_options") || typeof remote.pricing?.web_search === "number",
    supportsReasoning: supportedParameters.includes("reasoning") || supportedParameters.includes("include_reasoning"),
    supportsTools: supportedParameters.includes("plugins") || supportedParameters.includes("tools") || supportedParameters.includes("tool_choice"),
    supportsTextOutput: outputModalities.includes("text") || outputModalities.length === 0,
    supportsImageOutput: outputModalities.includes("image"),
    curatedGroups: []
  };
  normalized.curatedGroups = inferCuratedGroups(normalized);
  return normalized;
}

export async function fetchRouterModelCatalogLive() {
  const payload = await routerAiJsonRequest<{ data?: RouterRemoteModel[] }>({
    path: "/models",
    method: "GET",
    cacheKey: "routerai:models",
    cacheTtlSec: MODEL_CACHE_TTL_SEC
  });

  return Array.isArray(payload.data) ? payload.data.map(normalizeRouterModel) : [];
}

function inferMinPlan(model: RouterModelCatalogItem): Plan {
  const total = Number(model.pricing?.prompt || 0) + Number(model.pricing?.completion || 0) + Number(model.pricing?.image || 0) + Number(model.pricing?.audio || 0);
  if (total <= 0.000001) return Plan.FREE;
  if (total <= 0.00001) return Plan.BASE;
  if (total <= 0.00003) return Plan.PRO;
  if (total <= 0.00008) return Plan.ULTRA;
  return Plan.BUSINESS;
}

function inferMaxTokens(model: RouterModelCatalogItem) {
  return Math.min(16384, Math.max(2048, Math.floor((model.contextLength || 16384) / 4)));
}

export async function syncRouterModelCatalog(force = false) {
  const catalog = await fetchRouterModelCatalogLive();
  if (!catalog.length) {
    return [];
  }

  const existing = await prisma.modelConfig.findMany({
    where: { id: { in: catalog.map((item) => item.id) } }
  });
  const existingMap = new Map(existing.map((item) => [item.id, item]));

  await prisma.modelConfig.createMany({
    data: catalog
      .filter((item) => !existingMap.has(item.id))
      .map((item) => ({
        id: item.id,
        displayName: item.name,
        provider: item.provider,
        isEnabled: true,
        isFeatured: ["top_chat", "top_image", "top_audio"].some((group) => item.curatedGroups.includes(group)),
        featuredGroup: item.curatedGroups[0] || null,
        featuredOrder: 0,
        minPlan: inferMinPlan(item),
        markupFactor: 1,
        inputPrice: Number(item.pricing?.prompt || 0),
        outputPrice: Number(item.pricing?.completion || 0),
        maxTokens: inferMaxTokens(item),
        supportsImages: item.supportsImages || item.supportsImageOutput,
        supportsFiles: item.supportsFiles,
        supportsAudio: item.supportsAudio || item.outputModalities.includes("audio"),
        supportsVideo: item.supportsVideo,
        supportsReasoning: item.supportsReasoning,
        supportsTools: item.supportsTools,
        supportsWebSearch: item.supportsWebSearch
      })),
    skipDuplicates: true
  });

  for (const item of catalog) {
    const current = existingMap.get(item.id);
    await prisma.modelConfig.update({
      where: { id: item.id },
      data: {
        displayName: item.name,
        provider: item.provider,
        minPlan: current?.minPlan || inferMinPlan(item),
        inputPrice: Number(item.pricing?.prompt || 0),
        outputPrice: Number(item.pricing?.completion || 0),
        maxTokens: inferMaxTokens(item),
        supportsImages: item.supportsImages || item.supportsImageOutput,
        supportsFiles: item.supportsFiles,
        supportsAudio: item.supportsAudio || item.outputModalities.includes("audio"),
        supportsVideo: item.supportsVideo,
        supportsReasoning: item.supportsReasoning,
        supportsTools: item.supportsTools,
        supportsWebSearch: item.supportsWebSearch,
        ...(current?.featuredGroup ? {} : { featuredGroup: item.curatedGroups[0] || null })
      }
    });
  }

  return catalog;
}

export async function getRouterModelCatalog() {
  const configs = await prisma.modelConfig.findMany();
  if (configs.length > 0) {
    return configs.map((config) => {
      const name = config.displayName || config.id;
      const provider = config.provider || toProviderName(config.id);
      const fallback = normalizeRouterModel({
        id: config.id,
        name,
        pricing: {
          prompt: Number(config.inputPrice || 0),
          completion: Number(config.outputPrice || 0)
        },
        context_length: Number(config.maxTokens || 0) * 4,
        supported_parameters: [
          ...(config.supportsWebSearch ? ["web_search_options"] : []),
          ...(config.supportsTools ? ["tools"] : []),
          ...(config.supportsReasoning ? ["reasoning"] : [])
        ],
        architecture: {
          input_modalities: [
            "text",
            ...(config.supportsImages ? ["image"] : []),
            ...(config.supportsFiles ? ["file"] : []),
            ...(config.supportsAudio ? ["audio"] : []),
            ...(config.supportsVideo ? ["video"] : [])
          ],
          output_modalities: [
            "text",
            ...(config.supportsAudio ? ["audio"] : []),
            ...(config.supportsImages ? ["image"] : [])
          ]
        }
      });

      return {
        ...fallback,
        name,
        provider,
        isFeatured: Boolean(config.isFeatured),
        featuredGroup: config.featuredGroup || null,
        featuredOrder: config.featuredOrder || 0,
        minPlan: config.minPlan || inferMinPlan(fallback),
        isEnabled: config.isEnabled
      };
    });
  }

  return syncRouterModelCatalog();
}

export async function getCuratedModelSections(plan?: Plan) {
  const catalog = await getRouterModelCatalog();
  const allowed = plan ? catalog.filter((item) => item.isEnabled && (!item.minPlan || planRank[item.minPlan] <= planRank[plan])) : catalog.filter((item) => item.isEnabled);
  const fromAdmin = new Map<FeaturedGroup, RouterModelCatalogItem[]>();
  for (const group of FEATURED_GROUPS) fromAdmin.set(group, []);

  for (const item of allowed) {
    if ((item as unknown as ModelConfig).featuredGroup && item.isFeatured) {
      const key = (item.featuredGroup || "") as FeaturedGroup;
      if (fromAdmin.has(key)) fromAdmin.get(key)?.push(item);
    }
  }

  for (const group of FEATURED_GROUPS) {
    if ((fromAdmin.get(group)?.length || 0) === 0) {
      fromAdmin.set(group, allowed.filter((item) => item.curatedGroups.includes(group)).slice(0, 8));
    } else {
      fromAdmin.set(group, fromAdmin.get(group)!.sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0)));
    }
  }

  return {
    sections: Object.fromEntries(FEATURED_GROUPS.map((group) => [group, fromAdmin.get(group) || []])),
    leaders: {
      chatgpt: allowed.find((item) => item.id.toLowerCase().includes("gpt")) || null,
      claude: allowed.find((item) => item.id.toLowerCase().includes("claude")) || null,
      gemini: allowed.find((item) => item.id.toLowerCase().includes("gemini")) || null,
      grok: allowed.find((item) => item.id.toLowerCase().includes("grok")) || null,
      nanoBanana: allowed.find((item) => item.name.toLowerCase().includes("nano banana") || item.id.toLowerCase().includes("banana")) || null
    }
  };
}

export async function findRouterModelConfig(modelId: string) {
  const current = await prisma.modelConfig.findUnique({ where: { id: modelId } });
  if (current) {
    return current;
  }
  await syncRouterModelCatalog();
  return prisma.modelConfig.findUnique({ where: { id: modelId } });
}

export async function getPreferredRouterModel(params: {
  forImageOutput?: boolean;
  forImageInput?: boolean;
  forAudioInput?: boolean;
  forAudioOutput?: boolean;
  forVideoInput?: boolean;
  forWebSearch?: boolean;
}) {
  const catalog = await getRouterModelCatalog();
  return (
    catalog.find((item) => {
      if (!item.isEnabled) return false;
      if (params.forImageOutput && !item.supportsImageOutput) return false;
      if (params.forImageInput && !item.supportsImages) return false;
      if (params.forAudioInput && !item.supportsAudio) return false;
      if (params.forAudioOutput && !item.outputModalities.includes("audio")) return false;
      if (params.forVideoInput && !item.supportsVideo) return false;
      if (params.forWebSearch && !item.supportsWebSearch) return false;
      return true;
    }) || null
  );
}
