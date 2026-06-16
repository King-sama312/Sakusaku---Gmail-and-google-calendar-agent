import { Router } from "express";
import { randomBytes } from "node:crypto";
import { logger } from "@repo/logger";
import { env as servicesEnv } from "@repo/services/env";
import { corsair, setTenantGoogleTokens } from "@repo/services/corsair";
import { googleOAuth2Client } from "@repo/services/clients/google-oauth";
import UserService from "@repo/services/user";
import { setupCorsair } from "corsair";
import { env } from "../env";

const userService = new UserService();
const isProduction = env.NODE_ENV === "prod";

const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar",
];

function setOAuthStateCookie(res: Parameters<typeof clearOAuthStateCookie>[0], state: string) {
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: "/",
  });
}

function clearOAuthStateCookie(res: import("express").Response) {
  res.clearCookie("oauth_state", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie(servicesEnv.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: servicesEnv.SESSION_DURATION_MS,
    path: "/",
  });
}

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * GET /auth/google — Start the unified Google OAuth flow.
   * Generates a CSRF state, stores it in an httpOnly cookie, and redirects to Google.
   */
  router.get("/google", async (_req, res) => {
    const state = randomBytes(32).toString("hex");
    setOAuthStateCookie(res, state);

    const url = googleOAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_OAUTH_SCOPES,
      state,
    });

    return res.redirect(url);
  });

  /**
   * GET /auth/google/callback — Complete sign-in/sign-up and provision Corsair.
   * Verifies the state cookie, creates/updates the user, sets the auth cookie,
   * and stores the Google tokens for both Gmail and Calendar plugins.
   */
  router.get("/google/callback", async (req, res) => {
    const { code, state, error } = req.query;

    clearOAuthStateCookie(res);

    if (error && typeof error === "string") {
      return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
      return res.redirect(`${env.FRONTEND_URL}/login?error=missing_params`);
    }

    const storedState = req.cookies?.oauth_state;
    if (!storedState || storedState !== state) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=invalid_state`);
    }

    try {
      const { token, userId, accessToken, refreshToken, expiresIn } =
        await userService.googleSignup(code);

      setAuthCookie(res, token);

      // Provision the user as a Corsair tenant and store the OAuth tokens
      // so Gmail/Calendar APIs work without a separate connect step.
      try {
        await setupCorsair(corsair, { tenantId: userId });
        await setTenantGoogleTokens(userId, { accessToken, refreshToken, expiresIn });
      } catch (provisionErr) {
        logger.error("Corsair provisioning failed", { error: provisionErr, userId });
        // non-fatal — core auth succeeded; user can retry later
      }

      return res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
      logger.error("Google OAuth callback failed", { error });
      return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  });

  return router;
}
