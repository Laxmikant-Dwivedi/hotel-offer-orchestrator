import { Router } from "express";
import { checkSupplierAHealth, checkSupplierBHealth } from "../temporal/activities";
import { redis } from "../redisClient";
import { logger } from "../logger";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const [supplierA, supplierB] = await Promise.all([checkSupplierAHealth(), checkSupplierBHealth()]);

  let redisHealthy = true;
  try {
    await redis.ping();
  } catch (error) {
    redisHealthy = false;
    logger.error("Redis health check failed", { error: error instanceof Error ? error.message : String(error) });
  }

  const overallHealthy = supplierA.healthy && supplierB.healthy && redisHealthy;

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? "healthy" : "degraded",
    dependencies: {
      supplierA,
      supplierB,
      redis: { healthy: redisHealthy },
    },
    timestamp: new Date().toISOString(),
  });
});
