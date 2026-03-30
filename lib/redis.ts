import { createClient } from "redis";

type AppRedisClient = ReturnType<typeof createClient>;

declare global {
  var __elbruswayRedisClient: AppRedisClient | null | undefined;
  var __elbruswayRedisConnectPromise: Promise<AppRedisClient | null> | undefined;
}

function getRedisUrl() {
  const value = process.env.REDIS_URL?.trim();
  return value ? value : null;
}

export async function getRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (globalThis.__elbruswayRedisClient?.isOpen) {
    return globalThis.__elbruswayRedisClient;
  }

  if (!globalThis.__elbruswayRedisConnectPromise) {
    globalThis.__elbruswayRedisConnectPromise = (async () => {
      const client = createClient({ url: redisUrl });
      client.on("error", () => {});

      try {
        await client.connect();
        globalThis.__elbruswayRedisClient = client;
        return client;
      } catch {
        try {
          await client.disconnect();
        } catch {}

        globalThis.__elbruswayRedisClient = null;
        return null;
      } finally {
        globalThis.__elbruswayRedisConnectPromise = undefined;
      }
    })();
  }

  return globalThis.__elbruswayRedisConnectPromise;
}
