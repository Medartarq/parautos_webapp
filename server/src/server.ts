import { createApp } from "./app.js";
import { getEnvironment } from "./config/env.js";

async function start(): Promise<void> {
  const env = getEnvironment();
  const app = createApp();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.info(`PARAUTOS API listening on port ${env.PORT}`);
  });
}

start().catch((error: unknown) => {
  console.error("PARAUTOS API could not start.", error);
  process.exitCode = 1;
});
