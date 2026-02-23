import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Set env vars before any module is imported — satisfies db.ts DATABASE_URL check
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/clawfinance_test",
      REDIS_URL: "redis://localhost:6379",
      CLAWFINANCE_API_KEY: "test-api-key-12345",
      TAX_UPLOAD_DIR: "/tmp/clawfinance-test-uploads",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
