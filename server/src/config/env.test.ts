import { describe, expect, it } from "vitest";
import { getEnvironment } from "./env.js";

describe("environment configuration", () => {
  it("loads a valid environment", () => {
    process.env = {
      ...process.env,
      DB_HOST: "localhost",
      DB_PORT: "3310",
      DB_NAME: "parautos",
      DB_USER: "app",
      DB_PASSWORD: "secret",
      BOOTSTRAP_ADMIN_EMAIL: "admin@parautos.pe",
      BOOTSTRAP_ADMIN_TOKEN: "a".repeat(32)
    };
    expect(getEnvironment().DB_PORT).toBe(3310);
  });
});
