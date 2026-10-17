import { createApp } from "./app.js";
import { getEnvironment } from "./config/env.js";

const env = getEnvironment();
const app = createApp();

app.listen(env.PORT, "0.0.0.0", () => {
  console.info(`PARAUTOS API listening on port ${env.PORT}`);
});
