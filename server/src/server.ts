import { createApp } from "./app.js";
import { getEnvironment } from "./config/env.js";
import { technicalLogger } from "./logging/technical-logger.js";
import { once } from "node:events";

async function start(): Promise<void> {
  const env = getEnvironment();
  const app = createApp();
  const server = app.listen(env.PORT, "0.0.0.0");
  await once(server, "listening");
  technicalLogger.started(env.PORT);
}

start().catch((error: unknown) => {
  technicalLogger.failure("startup_failed", error);
  process.exitCode = 1;
});
