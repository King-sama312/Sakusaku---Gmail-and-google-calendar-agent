import { router } from "./trpc";

import { healthRouter, chaiRouter } from "./routes/health/route";
import { authRouter } from "./routes/auth/route";
import { gmailRouter } from "./routes/gmail/route";
import { calendarRouter } from "./routes/calendar/route";
import { chatRouter } from "./routes/chat/route";

export const serverRouter = router({
  health: healthRouter,
  auth: authRouter,
  chaicode: chaiRouter,
  gmail: gmailRouter,
  calendar: calendarRouter,
  chat: chatRouter,
});

export { createContext } from "./context";
export type ServerRouter = typeof serverRouter;
