import { z } from "zod";

const envSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string(),
  JWT_SECRET: z.string().describe("secret key for JWT tokens"),
  AUTH_COOKIE_NAME: z.string().default("accessToken").describe("name of the auth cookie"),
  COOKIE_DOMAIN: z.string().optional().describe("optional domain override for cookies"),
  SESSION_DURATION_MS: z.coerce
    .number()
    .positive()
    .default(31536000000)
    .describe("session duration in ms"),
  NODE_ENV: z.enum(["development", "prod", "production"]).default("development"),
  FRONTEND_URL: z.string().default("http://localhost:3000").describe("Frontend URL for redirects"),
  DATABASE_URL: z.string().describe("Database URL for postgres connection"),
  CORSAIR_KEK: z.string().describe("Key Encryption Key for Corsair credential encryption"),
});

function createEnv(env: NodeJS.ProcessEnv) {
  const safeParseResult = envSchema.safeParse(env);
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
