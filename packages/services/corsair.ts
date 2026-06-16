import { Pool } from "pg";
import { createCorsair, setupCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { env } from "./env";
import { gmailWebhookHooks, calendarWebhookHooks } from "./webhooks";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const corsair = createCorsair({
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gmail({ webhookHooks: gmailWebhookHooks as any }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    googlecalendar({ webhookHooks: calendarWebhookHooks as any }),
  ],
  database: pool,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
});

/** Shape of the per-plugin account key manager Corsair exposes on a tenant. */
export type TenantKeys = {
  get_access_token(): Promise<string | null>;
  get_refresh_token(): Promise<string | null>;
  get_expires_at(): Promise<number | null>;
  set_access_token(value: string | null): Promise<void>;
  set_refresh_token(value: string | null): Promise<void>;
  set_expires_at(value: number | null): Promise<void>;
};

/** Ensure Corsair integration rows and OAuth app credentials are set up. Idempotent. */
export async function corsairInit() {
  // Creates integration rows for every registered plugin (gmail, googlecalendar).
  await setupCorsair(corsair);

  // Store the shared Google OAuth app credentials once, if they are not already set.
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  const integrations = [
    { name: "gmail" as const, keys: corsair.keys.gmail },
    { name: "googlecalendar" as const, keys: corsair.keys.googlecalendar },
  ];

  for (const { keys } of integrations) {
    const existing = await keys.get_client_id().catch(() => null);
    if (!existing) {
      await keys.set_client_id(clientId);
      await keys.set_client_secret(clientSecret);
    }
  }
}

/**
 * Store Google OAuth tokens for both Gmail and Calendar plugins on a tenant.
 * If no refresh token is returned (e.g. re-login) the existing one is preserved.
 */
export async function setTenantGoogleTokens(
  userId: string,
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresIn: number | null;
  },
) {
  const tenant = corsair.withTenant(userId) as unknown as {
    gmail: { keys: TenantKeys };
    googlecalendar: { keys: TenantKeys };
  };

  const [existingGmailRefresh] = await Promise.all([tenant.gmail.keys.get_refresh_token()]);

  if (tokens.accessToken) {
    await tenant.gmail.keys.set_access_token(tokens.accessToken);
    await tenant.googlecalendar.keys.set_access_token(tokens.accessToken);
  }

  const refreshToken = tokens.refreshToken ?? existingGmailRefresh;
  if (refreshToken) {
    await tenant.gmail.keys.set_refresh_token(refreshToken);
    await tenant.googlecalendar.keys.set_refresh_token(refreshToken);
  }

  if (tokens.expiresIn) {
    const expiresAt = Date.now() + tokens.expiresIn * 1000;
    await tenant.gmail.keys.set_expires_at(expiresAt);
    await tenant.googlecalendar.keys.set_expires_at(expiresAt);
  }
}
