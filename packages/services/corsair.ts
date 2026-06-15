import { Pool } from "pg";
import { createCorsair } from "corsair";
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
