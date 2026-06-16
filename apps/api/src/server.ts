import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";
import UserService from "@repo/services/user";
import { env as servicesEnv } from "@repo/services/env";
import { setupUserWebhooks } from "@repo/services/webhooks";
import { processWebhook } from "corsair";
import { corsair } from "@repo/services/corsair";

import { env } from "./env";
import { createAuthRouter } from "./routes/auth";

import cookieParser from "cookie-parser";

const WEBHOOK_BASE_URL = env.WEBHOOK_BASE_URL ?? env.BASE_URL;

const userService = new UserService();

export const app = express();
app.set("trust proxy", 1);
const openApiDocument = generateOpenApiDocument(serverRouter, {
  title: `${env.APP_NAME} OpenAPI`,
  version: "1.0.0",
  baseUrl: env.BASE_URL.concat("/api"),
});

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  }),
);

app.use(cookieParser());

app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ message: `${env.APP_NAME} is up and running...` });
});

app.get("/health", (req, res) => {
  return res.json({ message: `${env.APP_NAME} server is healthy`, healthy: true });
});

logger.debug(`openapi.json: ${env.BASE_URL}/openapi.json`);
app.get("/openapi.json", (req, res) => {
  return res.json(openApiDocument);
});

logger.debug(`docs: ${env.BASE_URL}/docs`);
app.use("/docs", apiReference({ url: "/openapi.json" }));

app.use("/auth", createAuthRouter());

app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const start = Date.now();
  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const url = new URL(req.url, `${WEBHOOK_BASE_URL}`);
    const tenantId = url.searchParams.get("tenantId") ?? undefined;
    logger.info("Webhook received", {
      webhookId,
      tenantId,
      method: req.method,
      path: url.pathname,
    });
    const result = await processWebhook(
      corsair,
      Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
      req.body,
      { tenantId },
    );
    const duration = Date.now() - start;
    const statusCode = result.response?.statusCode ?? (result.response?.success ? 200 : 500);
    logger.info("Webhook processed", {
      webhookId,
      plugin: result.plugin,
      action: result.action,
      statusCode,
      durationMs: duration,
    });
    res
      .status(statusCode)
      .json(result.response?.data ?? { success: result.response?.success ?? false });
  } catch (error) {
    const duration = Date.now() - start;
    logger.error("Webhook processing failed", { webhookId, error, durationMs: duration });
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * GET /api/webhook/status — Check if the webhook endpoint is reachable
 * and verify corsair integration status. Useful for ngrok / deployment verification.
 */
app.get("/api/webhook/status", async (_req, res) => {
  return res.json({
    ok: true,
    webhookUrl: `${WEBHOOK_BASE_URL}/api/webhook`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/setup-webhooks — Subscribe the authenticated user to real-time
 * push notifications for Gmail (new emails) and Calendar (event changes).
 *
 * Requires the user to have completed OAuth with Gmail scopes (gmail.readonly, calendar).
 * After this, Google will push changes to POST /api/webhook.
 */
app.post("/api/setup-webhooks", express.json(), async (req, res) => {
  try {
    const token = req.cookies?.[servicesEnv.AUTH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const { id: userId } = await userService.verifyAndDecodeUserToken(token);
    const results = await setupUserWebhooks(userId, WEBHOOK_BASE_URL);
    const allOk = Object.values(results).every((r) => r.success);
    return res.status(allOk ? 200 : 207).json({ userId, results });
  } catch (error) {
    logger.error("Webhook setup failed", { error });
    return res.status(500).json({ error: "Webhook setup failed", details: String(error) });
  }
});

app.use(
  "/api",
  createOpenApiExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: serverRouter,
    createContext,
  }),
);

export default app;
