import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: [
            "src/**/*.integration.test.{ts,tsx}",
            "src/**/*.e2e.test.{ts,tsx}",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.{ts,tsx}"],
          setupFiles: ["src/test/setup-integration.ts"],
          testTimeout: 20000,
          hookTimeout: 45000,
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          environment: "node",
          include: ["src/**/*.e2e.test.{ts,tsx}"],
          setupFiles: ["src/test/setup-e2e.ts"],
          testTimeout: 40000,
          hookTimeout: 90000,
          fileParallelism: false,
        },
      },
    ],
  },
});
