import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";

// REDIS_URL (a full redis:// connection string) takes precedence when set,
// which is the form managed providers like Render's Key Value hand out.
// Falls back to discrete host/port for local dev and Docker Compose.
export const redis = config.redisUrl
  ? new Redis(config.redisUrl, { maxRetriesPerRequest: 3 })
  : new Redis({
      host: config.redisHost,
      port: config.redisPort,
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
});

redis.on("connect", () => {
  logger.info("Redis connected", { target: config.redisUrl ? "REDIS_URL" : `${config.redisHost}:${config.redisPort}` });
});
