import { plans } from "@/lib/plans";
import { getRedisClient } from "@/lib/redis";

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetAt: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_SECONDS = 60 * 60;
const memoryStore = new Map<string, MemoryEntry>();

function getWindow() {
  const now = Date.now();
  return {
    now,
    resetAt: now + WINDOW_SECONDS * 1000
  };
}

function getLimitForPlan(plan: keyof typeof plans) {
  return plans[plan].requestsPerHour;
}

function applyMemoryRateLimit(key: string, limit: number) {
  const { now, resetAt } = getWindow();
  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      result: {
        limit,
        remaining: Math.max(0, limit - 1),
        resetAt
      }
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      result: {
        limit,
        remaining: 0,
        resetAt: current.resetAt
      }
    };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return {
    allowed: true,
    result: {
      limit,
      remaining: Math.max(0, limit - current.count),
      resetAt: current.resetAt
    }
  };
}

async function applyRedisRateLimit(key: string, limit: number) {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  const ttl = WINDOW_SECONDS;
  const transaction = client.multi();
  transaction.incr(key);
  transaction.expire(key, ttl, "NX");
  transaction.ttl(key);

  const response = await transaction.exec();
  if (!response) {
    return null;
  }

  const count = Number(response[0] || 0);
  const ttlSeconds = Math.max(0, Number(response[2] || ttl));
  const resetAt = Date.now() + ttlSeconds * 1000;

  return {
    allowed: count <= limit,
    result: {
      limit,
      remaining: Math.max(0, limit - count),
      resetAt
    }
  };
}

export async function checkChatRateLimit(params: { userId: string; plan: keyof typeof plans }) {
  const limit = getLimitForPlan(params.plan);
  const key = `rate_limit:chat:${params.userId}`;

  const redisResult = await applyRedisRateLimit(key, limit);
  if (redisResult) {
    return redisResult;
  }

  return applyMemoryRateLimit(key, limit);
}

export function toRateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
  };
}
