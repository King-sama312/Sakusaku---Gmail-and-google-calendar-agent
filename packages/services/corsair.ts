import { Pool } from "pg";
import { createCorsair, setupCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { env } from "./env";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const corsair = createCorsair({
  plugins: [gmail(), googlecalendar()],
  database: pool,
  kek: env.CORSAIR_KEK,
  multiTenancy: true,
});

export { generateOAuthUrl, processOAuthCallback } from "corsair/oauth";

/** Ensure corsair integration rows and OAuth credentials are set up. Idempotent. */
export async function corsairInit() {
  // creates integration rows for every plugin (gmail, googlecalendar)
  await setupCorsair(corsair);

  // set OAuth client credentials from env if not already stored
  const c = corsair as unknown as {
    keys: Record<string, { get_client_id(): Promise<string | null>; set_client_id(v: string): Promise<void>; set_client_secret(v: string): Promise<void> }>;
  };

  for (const plugin of ["gmail", "googlecalendar"] as const) {
    const keyManager = c.keys[plugin];
    if (!keyManager) continue;
    const existing = await keyManager.get_client_id().catch(() => null);
    if (!existing && env.GOOGLE_OAUTH_CLIENT_ID) {
      await keyManager.set_client_id(env.GOOGLE_OAUTH_CLIENT_ID);
      await keyManager.set_client_secret(env.GOOGLE_OAUTH_CLIENT_SECRET);
    }
  }
}
