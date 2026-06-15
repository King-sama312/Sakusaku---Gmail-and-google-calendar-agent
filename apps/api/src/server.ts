import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";
import UserService from "@repo/services/user";
import { corsair } from "@repo/services/corsair";
import { processWebhook } from "corsair";

import { env } from "./env";

import cookieParser from "cookie-parser";

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

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.redirect(`${env.FRONTEND_URL}/signup?error=missing_code`);
  }

  try {
    const { token } = await userService.googleSignup(code);
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    logger.error("Google OAuth callback failed", { error });
    res.redirect(`${env.FRONTEND_URL}/signup?error=oauth_failed`);
  }
});

app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const result = await processWebhook(
      corsair,
      Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
      req.body,
      { tenantId: url.searchParams.get("tenantId") ?? undefined },
    );
    const statusCode = result.response?.statusCode ?? (result.response?.success ? 200 : 500);
    res.status(statusCode).json(result.response?.data ?? { success: result.response?.success ?? false });
  } catch (error) {
    logger.error("Corsair webhook error", { error });
    res.status(500).json({ error: "Webhook processing failed" });
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