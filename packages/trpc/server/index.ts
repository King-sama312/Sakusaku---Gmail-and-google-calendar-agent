import { router } from "./trpc";

import { healthRouter, chaiRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  chaicode: chaiRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
