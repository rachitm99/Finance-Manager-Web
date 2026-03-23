import { createClient } from "redis";

type AppRedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as {
  redisClient: AppRedisClient | null | undefined;
  redisInitPromise: Promise<AppRedisClient | null> | undefined;
};

async function initRedisClient(): Promise<AppRedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  const client = createClient({ url });
  client.on("error", () => {
    // Keep request flow resilient when Redis is temporarily unavailable.
  });

  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

export async function getRedisClient(): Promise<AppRedisClient | null> {
  if (globalForRedis.redisClient !== undefined) {
    return globalForRedis.redisClient;
  }

  if (!globalForRedis.redisInitPromise) {
    globalForRedis.redisInitPromise = initRedisClient();
  }

  globalForRedis.redisClient = await globalForRedis.redisInitPromise;
  return globalForRedis.redisClient;
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  const value = await client.get(key);
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function redisDel(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    return;
  }

  await client.del(key);
}
