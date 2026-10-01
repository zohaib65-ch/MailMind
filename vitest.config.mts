import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside React Server Components; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "tests/helpers/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["tests/helpers/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Integration tests each start their own in-memory MongoDB.
    fileParallelism: false,
  },
});
