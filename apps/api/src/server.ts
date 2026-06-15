import express from "express";
import { logger } from "@repo/logger";
import cors from "cors";

import * as trpcExpress from "@trpc/server/adapters/express";
import { generateOpenApiDocument, createOpenApiExpressMiddleware } from "trpc-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

import { serverRouter, createContext } from "@repo/trpc/server";
import UserService from "@repo/services/user";
import { env as servicesEnv } from "@repo/services/env";
import { corsair, generateOAuthUrl, processOAuthCallback } from "@repo/services/corsair";
import { processWebhook, setupCorsair } from "corsair";

import { env } from "./env";

import cookieParser from "cookie-parser";

const userService = new UserService();

const GMAIL_REDIRECT_URI = `${env.BASE_URL}/auth/gmail/callback`;

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

app.get("/auth/gmail", async (req, res) => {
  try {
    const token = req.cookies?.[servicesEnv.AUTH_COOKIE_NAME];
    if (!token) {
      return res.redirect(`${env.FRONTEND_URL}/signup?error=not_authenticated`);
    }
    const { id: userId } = await userService.verifyAndDecodeUserToken(token);
    const { url } = await generateOAuthUrl(
      corsair,
      "gmail",
      { tenantId: userId, redirectUri: GMAIL_REDIRECT_URI },
    );
    return res.redirect(url);
  } catch (error) {
    logger.error("Gmail OAuth initiation failed", { error });
    return res.redirect(`${env.FRONTEND_URL}/mail?error=oauth_init_failed`);
  }
});

app.get("/auth/gmail/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || typeof code !== "string" || !state || typeof state !== "string") {
    return res.redirect(`${env.FRONTEND_URL}/mail?error=missing_params`);
  }
  try {
    await processOAuthCallback(corsair, {
      code,
      state,
      redirectUri: GMAIL_REDIRECT_URI,
    });
    return res.redirect(`${env.FRONTEND_URL}/mail?connected=gmail`);
  } catch (error) {
    logger.error("Gmail OAuth callback failed", { error });
    return res.redirect(`${env.FRONTEND_URL}/mail?error=oauth_callback_failed`);
  }
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.redirect(`${env.FRONTEND_URL}/signup?error=missing_code`);
  }

  try {
    const { token, userId, accessToken, refreshToken, expiresIn } = await userService.googleSignup(code);

    // Set auth cookie server-side
    const isProduction = env.NODE_ENV === "prod";
    res.cookie(servicesEnv.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: servicesEnv.SESSION_DURATION_MS,
      path: "/",
    });

    // Provision the user as a corsair tenant and store the Google OAuth tokens
    // so Gmail/Calendar APIs work without a separate connect step
    try {
      await setupCorsair(corsair, { tenantId: userId });

      const tenant = corsair.withTenant(userId) as unknown as {
        gmail: { keys: { set_access_token(v: string): Promise<void>; set_refresh_token(v: string): Promise<void>; set_expires_at(v: number): Promise<void> } };
        googlecalendar: { keys: { set_access_token(v: string): Promise<void>; set_refresh_token(v: string): Promise<void>; set_expires_at(v: number): Promise<void> } };
      };

      if (accessToken) {
        await tenant.gmail.keys.set_access_token(accessToken);
        await tenant.googlecalendar.keys.set_access_token(accessToken);
      }
      if (refreshToken) {
        await tenant.gmail.keys.set_refresh_token(refreshToken);
        await tenant.googlecalendar.keys.set_refresh_token(refreshToken);
      }
      if (expiresIn) {
        const expiresAt = Date.now() + expiresIn * 1000;
        await tenant.gmail.keys.set_expires_at(expiresAt);
        await tenant.googlecalendar.keys.set_expires_at(expiresAt);
      }
    } catch (provisionErr) {
      logger.error("Corsair provisioning failed", { error: provisionErr, userId });
      // non-fatal — user can connect Gmail manually via /auth/gmail
    }

    return res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
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