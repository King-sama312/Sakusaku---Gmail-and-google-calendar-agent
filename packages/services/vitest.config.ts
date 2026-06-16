import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      NODE_ENV: "development",
      GLM_BASE_URL: "https://open.bigmodel.cn/api/paas/v4",
      GLM_API_KEY: "test-key",
      GLM_MODEL: "glm-4",
      CHAT_MAX_HISTORY_MESSAGES: "50",
      CHAT_LLM_TIMEOUT_MS: "30000",
      CHAT_MAX_TOOL_RESULT_LENGTH: "4000",
      GOOGLE_OAUTH_CLIENT_ID: "test-client-id",
      GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
      GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:8000/auth/google/callback",
      JWT_SECRET: "test-jwt-secret",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CORSAIR_KEK: "test-corsair-kek-change-in-production-32bytes!",
      GMAIL_PUBSUB_TOPIC: "projects/test/topics/test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "**/*.test.ts", "**/*.config.ts"],
    },
  },
});
