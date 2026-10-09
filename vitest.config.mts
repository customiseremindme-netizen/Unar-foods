import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "tests/unit/server-only-stub.ts"),
    },
  },
  test: {
    include: process.env.VITEST_INTEGRATION ? ["tests/integration/**/*.test.ts"] : ["tests/unit/**/*.test.ts"],
    testTimeout: 30_000,
    // Database tests share one test database, so they run one file at a time.
    fileParallelism: !process.env.VITEST_INTEGRATION,
    environment: "node",
  },
});
