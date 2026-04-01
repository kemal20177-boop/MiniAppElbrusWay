import "server-only";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";

const baseUrl = process.env.ROUTERAI_BASE_URL || "https://routerai.ru/api/v1";
const apiKey = process.env.ROUTERAI_API_KEY?.trim();

export type RouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
};

export type RouterRequestOptions = {
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  cacheKey?: string;
  cacheTtlSec?: number;
  userId?: string;
  projectId?: string;
  chatId?: string;
  eventType?: string;
  model?: string;
};

function getHeaders() {
  if (!apiKey) {
    throw new Error("ROUTERAI_API_KEY_MISSING");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

async function readCache(cacheKey?: string) {
  if (!cacheKey) {
    return null;
  }
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }
  const raw = await redis.get(cacheKey);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as unknown;
}

async function writeCache(cacheKey: string | undefined, value: unknown, ttlSec: number | undefined) {
  if (!cacheKey || !ttlSec) {
    return;
  }
  const redis = await getRedisClient();
  if (!redis) {
    return;
  }
  await redis.set(cacheKey, JSON.stringify(value), { EX: ttlSec });
}

async function logUsage(params: {
  userId?: string;
  projectId?: string;
  chatId?: string;
  eventType?: string;
  model?: string;
  usage?: RouterUsage | null;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}) {
  if (!params.userId) {
    return;
  }

  const promptTokens = Number(params.usage?.prompt_tokens ?? params.usage?.input_tokens ?? 0);
  const completionTokens = Number(params.usage?.completion_tokens ?? params.usage?.output_tokens ?? 0);
  const totalTokens = Number(params.usage?.total_tokens ?? promptTokens + completionTokens);

  await prisma.usageEvent.create({
    data: {
      userId: params.userId,
      projectId: params.projectId || null,
      chatId: params.chatId || null,
      model: params.model || null,
      eventType: params.eventType || "routerai.request",
      promptTokens,
      completionTokens,
      totalTokens,
      costRub: Number(params.metadata?.costRub || 0),
      metadata: {
        latencyMs: params.latencyMs,
        ...params.metadata
      }
    }
  });
}

export async function routerAiJsonRequest<T = unknown>(options: RouterRequestOptions) {
  const cached = await readCache(options.cacheKey);
  if (cached) {
    return cached as T;
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method || (options.body ? "POST" : "GET"),
    headers: getHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ROUTERAI_${options.path}_FAILED:${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as T & { usage?: RouterUsage };
  await logUsage({
    userId: options.userId,
    projectId: options.projectId,
    chatId: options.chatId,
    eventType: options.eventType,
    model: options.model,
    usage: (payload as { usage?: RouterUsage }).usage,
    latencyMs: Date.now() - startedAt,
    metadata: {
      endpoint: options.path
    }
  });
  await writeCache(options.cacheKey, payload, options.cacheTtlSec);
  return payload;
}

export async function routerAiStreamRequest(options: RouterRequestOptions) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${options.path}`, {
    method: options.method || "POST",
    headers: getHeaders(),
    body: JSON.stringify(options.body || {}),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ROUTERAI_${options.path}_FAILED:${response.status} ${await response.text()}`);
  }

  return {
    response,
    startedAt
  };
}

export function getRouterAiBaseUrl() {
  return baseUrl;
}
