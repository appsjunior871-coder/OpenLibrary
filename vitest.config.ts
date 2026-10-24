import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Each test file gets its own in-memory database (module state is per worker).
    isolate: true,
    fileParallelism: true,
  },
});
