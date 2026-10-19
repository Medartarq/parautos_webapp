import cors from "cors";
import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvironment } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { setupRouter } from "./modules/setup/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { ordersRouter } from "./modules/orders/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { attachmentsRouter } from "./modules/attachments/routes.js";
import { trackingRouter } from "./modules/tracking/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { demoRouter } from "./modules/demo/routes.js";
import { demoContext } from "./middleware/demo-context.js";

export function createApp(): express.Express {
  const env = getEnvironment();
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  app.get("/api/v1/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/v1/setup", setupRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/demo", demoRouter);
  app.use("/api/v1/tracking", trackingRouter);
  app.use("/api/v1/orders", demoContext, ordersRouter);
  app.use("/api/v1/audit", demoContext, auditRouter);
  app.use("/api/v1/reports", demoContext, reportsRouter);
  app.use("/api/v1/attachments", demoContext, attachmentsRouter);
  app.use("/api/v1/users", demoContext, usersRouter);

  // In production the API and the compiled React application share one origin.
  const clientDist = join(dirname(fileURLToPath(import.meta.url)), "../../client/dist");
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api\/).*/, (_request, response) => {
      response.sendFile(join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
