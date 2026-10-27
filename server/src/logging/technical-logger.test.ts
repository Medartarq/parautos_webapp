import { expect, it } from "vitest";
import { createTechnicalLogger } from "./technical-logger.js";

it("keeps correlation and error classification without serializing SQL or personal data", () => {
  const lines: string[] = [];
  const logger = createTechnicalLogger({ write: (line: string) => { lines.push(line); } });
  const error = Object.assign(new TypeError("password=SECRET; DNI=70000001"), {
    errno: 1062, sql: "INSERT INTO users VALUES ('PRIVATE_EMAIL')", sqlMessage: "PRIVATE_PHONE",
    config: { token: "PRIVATE_TOKEN" }, cause: new Error("PRIVATE_CAUSE"),
  });
  logger.failure("request_failed", error, "request-123");
  logger.failure("startup_failed", { password: "PRIVATE_PASSWORD", name: "PRIVATE_NAME" });
  logger.failure("database_connection_release_failed", error);
  logger.failure("database_connection_destroy_failed", error);
  expect(JSON.parse(lines[0])).toMatchObject({ event: "request_failed", errorType: "TypeError", errno: 1062, requestId: "request-123" });
  expect(lines.join("")).not.toMatch(/SECRET|70000001|PRIVATE_|INSERT|stack|sqlMessage|cause/);
});
