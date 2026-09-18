import { Worker, NativeConnection } from "@temporalio/worker";
import { config } from "../config";
import { logger } from "../logger";
import * as activities from "./activities";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({ address: config.temporalAddress });

  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: config.temporalTaskQueue,
    workflowsPath: require.resolve("./workflows"),
    activities,
  });

  logger.info("Temporal worker starting", {
    taskQueue: config.temporalTaskQueue,
    namespace: config.temporalNamespace,
    address: config.temporalAddress,
  });

  await worker.run();
}

run().catch((err) => {
  logger.error("Temporal worker crashed", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
