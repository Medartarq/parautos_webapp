import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root,
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@parautos/shared": fileURLToPath(new URL("../../shared/src/index.ts", import.meta.url)) } },
  test: {
    include: ["server/src/**/*.test.ts", "client/src/**/*.test.ts", "client/src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["server/src/**/*.ts", "client/src/**/*.ts", "client/src/**/*.tsx", "shared/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
      reportsDirectory: "coverage/sonarqube-completo",
      reporter: ["text-summary", "lcov", "json-summary", "json"],
    },
  },
});
