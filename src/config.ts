import "dotenv/config";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const config = {
  port: envInt("PORT", 3000),
  selfBaseUrl: process.env.SELF_BASE_URL || "http://localhost:3000",
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: envInt("REDIS_PORT", 6379),
  temporalAddress: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE || "default",
  temporalTaskQueue: process.env.TEMPORAL_TASK_QUEUE || "hotel-offer-task-queue",
  supplierTimeoutMs: envInt("SUPPLIER_TIMEOUT_MS", 5000),
  hotelsCacheTtlSeconds: envInt("HOTELS_CACHE_TTL_SECONDS", 300),
};
