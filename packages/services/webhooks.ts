import { OAuth2Client, type Credentials } from "google-auth-library";
import { logger } from "@repo/logger";
import { corsair } from "./corsair";
import { env } from "./env";

const GMAIL_WATCH_URL = "https://gmail.googleapis.com/gmail/v1/users/me/watch";
const CALENDAR_WATCH_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events/watch";

type TenantKeys = {
  get_access_token(): Promise<string | null>;
  get_refresh_token(): Promise<string | null>;
  get_expires_at(): Promise<number | null>;
  set_access_token(v: string | null): Promise<void>;
  set_refresh_token(v: string | null): Promise<void>;
  set_expires_at(v: number | null): Promise<void>;
};

async function createUserOAuth2Client(userId: string): Promise<OAuth2Client> {
  const tenant = corsair.withTenant(userId) as unknown as {
    gmail: { keys: TenantKeys };
    googlecalendar: { keys: TenantKeys };
  };

  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    tenant.gmail.keys.get_access_token(),
    tenant.gmail.keys.get_refresh_token(),
    tenant.gmail.keys.get_expires_at(),
  ]);

  const client = new OAuth2Client({
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  });

  client.setCredentials({
    access_token: accessToken ?? undefined,
    refresh_token: refreshToken ?? undefined,
    expiry_date: expiresAt ?? undefined,
  });

  client.on("tokens", async (tokens: Credentials) => {
    try {
      if (tokens.access_token) {
        await tenant.gmail.keys.set_access_token(tokens.access_token);
        await tenant.googlecalendar.keys.set_access_token(tokens.access_token);
      }
      if (tokens.refresh_token) {
        await tenant.gmail.keys.set_refresh_token(tokens.refresh_token);
        await tenant.googlecalendar.keys.set_refresh_token(tokens.refresh_token);
      }
      if (tokens.expiry_date) {
        await tenant.gmail.keys.set_expires_at(tokens.expiry_date);
        await tenant.googlecalendar.keys.set_expires_at(tokens.expiry_date);
      }
    } catch (err) {
      logger.error("Failed to persist refreshed OAuth tokens", { userId, error: err });
    }
  });

  return client;
}

/**
 * Set up Gmail push notification watch for a user.
 * Subscribes to push notifications delivered to our webhook endpoint.
 */
export async function setupGmailWatch(userId: string, webhookBaseUrl: string) {
  const client = await createUserOAuth2Client(userId);
  const response = await client.request<{
    historyId?: string;
    expiration?: string;
  }>({
    url: GMAIL_WATCH_URL,
    method: "POST",
    data: {
      labelIds: ["INBOX"],
      labelFilterAction: "include",
      topicName: env.GMAIL_PUBSUB_TOPIC,
    },
  });
  logger.info("Gmail watch created", {
    userId,
    historyId: response.data?.historyId,
    expiration: response.data?.expiration,
  });
  return response.data;
}

/**
 * Set up Google Calendar push notification watch for a user.
 * Subscribes to event changes delivered to our webhook endpoint.
 */
export async function setupCalendarWatch(userId: string, webhookBaseUrl: string) {
  const client = await createUserOAuth2Client(userId);
  const channelId = `sakusaku-cal-${userId.slice(0, 8)}-${Date.now()}`;
  const response = await client.request<{
    id?: string;
    resourceId?: string;
    expiration?: string;
  }>({
    url: CALENDAR_WATCH_URL,
    method: "POST",
    data: {
      id: channelId,
      type: "web_hook",
      address: `${webhookBaseUrl}/api/webhook?tenantId=${userId}`,
    },
  });
  logger.info("Calendar watch created", {
    userId,
    channelId: response.data?.id,
    resourceId: response.data?.resourceId,
    expiration: response.data?.expiration,
  });
  return response.data;
}

/**
 * Set up both Gmail and Calendar watches for a user.
 */
export async function setupUserWebhooks(userId: string, webhookBaseUrl: string) {
  const results: Record<string, { success: boolean; error?: string; data?: unknown }> = {};

  try {
    const gmailResult = await setupGmailWatch(userId, webhookBaseUrl);
    results.gmail = { success: true, data: gmailResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Gmail watch setup failed", { userId, error: message });
    results.gmail = { success: false, error: message };
  }

  try {
    const calResult = await setupCalendarWatch(userId, webhookBaseUrl);
    results.calendar = { success: true, data: calResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Calendar watch setup failed", { userId, error: message });
    results.calendar = { success: false, error: message };
  }

  return results;
}

/**
 * Gmail webhook hooks for corsair plugin.
 * Logs before/after webhook processing and records event metadata.
 */
export const gmailWebhookHooks = {
  messageChanged: {
    before: async (_ctx: Record<string, unknown>, request: unknown) => {
      const payload = request as { emailAddress?: string; historyId?: string };
      logger.info("Gmail webhook received", {
        plugin: "gmail",
        webhook: "messageChanged",
        emailAddress: payload?.emailAddress ?? "unknown",
        historyId: payload?.historyId ?? "unknown",
      });
      return { ctx: _ctx, args: request };
    },
    after: async (_ctx: Record<string, unknown>, response: unknown) => {
      logger.info("Gmail webhook processed", {
        plugin: "gmail",
        webhook: "messageChanged",
        handled: !!response,
      });
    },
  },
};

/**
 * Calendar webhook hooks for corsair plugin.
 * Logs before/after webhook processing and records event metadata.
 */
export const calendarWebhookHooks = {
  onEventChanged: {
    before: async (_ctx: Record<string, unknown>, request: unknown) => {
      const payload = request as { type?: string; calendarId?: string };
      logger.info("Calendar webhook received", {
        plugin: "googlecalendar",
        webhook: "onEventChanged",
        eventType: payload?.type ?? "unknown",
        calendarId: payload?.calendarId ?? "unknown",
      });
      return { ctx: _ctx, args: request };
    },
    after: async (_ctx: Record<string, unknown>, response: unknown) => {
      logger.info("Calendar webhook processed", {
        plugin: "googlecalendar",
        webhook: "onEventChanged",
        handled: !!response,
      });
    },
  },
};
