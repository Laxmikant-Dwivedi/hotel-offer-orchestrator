import express from "express";
import cors from "cors";
import { config } from "./config";
import { logger } from "./logger";
import { suppliersRouter } from "./suppliers/router";
import { hotelsRouter } from "./routes/hotelsRouter";
import { healthRouter } from "./routes/healthRouter";

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  logger.info("Incoming request", { method: req.method, path: req.path, query: req.query });
  next();
});

app.use(healthRouter);
app.use(hotelsRouter);
app.use(suppliersRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Unhandled error", { error: message });
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, () => {
  logger.info("Hotel Offer Orchestrator API listening", { port: config.port });
});
