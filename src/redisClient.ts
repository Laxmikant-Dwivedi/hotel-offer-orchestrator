import Redis from "ioredis";
import { config } from "./config";
import { logger } from "./logger";

export const redis = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
});

redis.on("connect", () => {
  logger.info("Redis connected", { host: config.redisHost, port: config.redisPort });
});
