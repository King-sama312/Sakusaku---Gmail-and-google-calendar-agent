import type GmailService from "../gmail";
import type CalendarService from "../calendar";
import type { ToolDefinition, ToolResult } from "./model";

export type ToolExecutorContext = {
  userId: string;
  gmailService: GmailService;
  calendarService: CalendarService;
};

export type ToolExecutor = (
  toolCallId: string,
  args: unknown,
  ctx: ToolExecutorContext,
) => Promise<ToolResult>;

const DEFAULT_THREADS_LIMIT = 20;
const DEFAULT_EVENTS_DAYS = 7;

function parseJsonArgs(args: unknown): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof args === "object" && args !== null) {
    return args as Record<string, unknown>;
  }
  return {};
}

function success(toolCallId: string, toolName: string, data: unknown): ToolResult {
  return {
    toolCallId,
    toolName,
    content: typeof data === "string" ? data : JSON.stringify(data),
    error: false,
  };
}

function failure(toolCallId: string, toolName: string, err: unknown): ToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    toolCallId,
    toolName,
    content: `Error: ${message}`,
    error: true,
  };
}

function getTodayRange(): { timeMin: string; timeMax: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DEFAULT_EVENTS_DAYS);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

export const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_threads",
      description:
        "List recent Gmail inbox threads. Optionally pass a Gmail search query `q` to filter results.",
      parameters: {
        type: "object",
        properties: {
          q: {
            type: "string",
            description: "Gmail search query (e.g. 'from:alice@example.com').",
          },
          maxResults: {
            type: "integer",
            description: "Maximum number of threads to return (default 20, max 50).",
            minimum: 1,
            maximum: 50,
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_thread",
      description:
        "Get the full content of a Gmail thread by ID. Use this when the user wants to read a specific thread.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The Gmail thread ID.",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_email",
      description:
        "Send a plain-text email. Ask for confirmation if the request is ambiguous. Returns the sent message metadata.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address.",
          },
          subject: {
            type: "string",
            description: "Email subject.",
          },
          body: {
            type: "string",
            description: "Plain-text email body.",
          },
          cc: {
            type: "string",
            description: "Optional CC recipient email address.",
          },
        },
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_draft",
      description: "Save a plain-text email as a draft without sending it.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient email address.",
          },
          subject: {
            type: "string",
            description: "Email subject.",
          },
          body: {
            type: "string",
            description: "Plain-text email body.",
          },
          cc: {
            type: "string",
            description: "Optional CC recipient email address.",
          },
        },
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_events",
      description:
        "List Google Calendar events in a time range. Defaults to the next 7 days if no range is provided.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start of the time range in RFC 3339 format.",
          },
          timeMax: {
            type: "string",
            description: "End of the time range in RFC 3339 format.",
          },
          maxResults: {
            type: "integer",
            description: "Maximum number of events to return (default 50).",
            minimum: 1,
            maximum: 2500,
          },
          q: {
            type: "string",
            description: "Free-text search terms.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "Create a Google Calendar event. Use ISO 8601 date-times with timezone for start and end. Ask for confirmation if the request is ambiguous.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Event title.",
          },
          description: {
            type: "string",
            description: "Optional event description.",
          },
          location: {
            type: "string",
            description: "Optional event location.",
          },
          start: {
            type: "string",
            description: "Start time in RFC 3339 format, e.g. 2026-06-20T14:00:00+05:30.",
          },
          end: {
            type: "string",
            description: "End time in RFC 3339 format, e.g. 2026-06-20T15:00:00+05:30.",
          },
          timeZone: {
            type: "string",
            description: "IANA time zone name, e.g. Asia/Shanghai.",
          },
          attendees: {
            type: "array",
            description: "List of attendee email addresses.",
            items: { type: "string", format: "email" },
          },
          sendUpdates: {
            type: "string",
            enum: ["all", "externalOnly", "none"],
            description: "Whether to send notifications to attendees (default all).",
          },
        },
        required: ["summary", "start", "end"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_availability",
      description: "Check free/busy availability for the user's primary calendar in a time range.",
      parameters: {
        type: "object",
        properties: {
          timeMin: {
            type: "string",
            description: "Start of the time range in RFC 3339 format.",
          },
          timeMax: {
            type: "string",
            description: "End of the time range in RFC 3339 format.",
          },
          timeZone: {
            type: "string",
            description: "Optional IANA time zone name.",
          },
        },
        required: ["timeMin", "timeMax"],
        additionalProperties: false,
      },
    },
  },
];

export const toolExecutorMap: Record<string, ToolExecutor> = {
  list_threads: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const q = typeof params.q === "string" ? params.q : undefined;
    const maxResults =
      typeof params.maxResults === "number"
        ? Math.min(Math.max(params.maxResults, 1), 50)
        : DEFAULT_THREADS_LIMIT;
    try {
      const data = await ctx.gmailService.listThreads(ctx.userId, { q, maxResults });
      return success(toolCallId, "list_threads", data);
    } catch (err) {
      return failure(toolCallId, "list_threads", err);
    }
  },

  get_thread: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const id = String(params.id ?? "");
    if (!id) {
      return failure(toolCallId, "get_thread", new Error("Thread ID is required"));
    }
    try {
      const data = await ctx.gmailService.getThread(ctx.userId, { id, format: "full" });
      return success(toolCallId, "get_thread", data);
    } catch (err) {
      return failure(toolCallId, "get_thread", err);
    }
  },

  send_email: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const to = String(params.to ?? "");
    const subject = String(params.subject ?? "");
    const body = String(params.body ?? "");
    const cc = typeof params.cc === "string" ? params.cc : undefined;
    if (!to || !subject || !body) {
      return failure(toolCallId, "send_email", new Error("to, subject, and body are required"));
    }
    try {
      const data = await ctx.gmailService.sendMessage(ctx.userId, { to, subject, body, cc });
      return success(toolCallId, "send_email", data);
    } catch (err) {
      return failure(toolCallId, "send_email", err);
    }
  },

  create_draft: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const to = String(params.to ?? "");
    const subject = String(params.subject ?? "");
    const body = String(params.body ?? "");
    const cc = typeof params.cc === "string" ? params.cc : undefined;
    if (!to || !subject || !body) {
      return failure(toolCallId, "create_draft", new Error("to, subject, and body are required"));
    }
    try {
      const data = await ctx.gmailService.createDraft(ctx.userId, { to, subject, body, cc });
      return success(toolCallId, "create_draft", data);
    } catch (err) {
      return failure(toolCallId, "create_draft", err);
    }
  },

  list_events: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const range =
      params.timeMin && params.timeMax
        ? {
            timeMin: String(params.timeMin),
            timeMax: String(params.timeMax),
          }
        : getTodayRange();
    const maxResults =
      typeof params.maxResults === "number" ? Math.min(params.maxResults, 2500) : 50;
    const q = typeof params.q === "string" ? params.q : undefined;
    try {
      const data = await ctx.calendarService.listEvents(ctx.userId, {
        ...range,
        maxResults,
        q,
        singleEvents: true,
        orderBy: "startTime",
      });
      return success(toolCallId, "list_events", data);
    } catch (err) {
      return failure(toolCallId, "list_events", err);
    }
  },

  create_event: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const summary = String(params.summary ?? "");
    const start = String(params.start ?? "");
    const end = String(params.end ?? "");
    if (!summary || !start || !end) {
      return failure(toolCallId, "create_event", new Error("summary, start, and end are required"));
    }
    const timeZone = typeof params.timeZone === "string" ? params.timeZone : undefined;
    const attendees = Array.isArray(params.attendees)
      ? params.attendees.map((email) => ({ email: String(email) }))
      : undefined;
    try {
      const data = await ctx.calendarService.createEvent(ctx.userId, {
        summary,
        description: typeof params.description === "string" ? params.description : undefined,
        location: typeof params.location === "string" ? params.location : undefined,
        start: { dateTime: start, timeZone },
        end: { dateTime: end, timeZone },
        attendees,
        sendUpdates:
          params.sendUpdates === "all" ||
          params.sendUpdates === "externalOnly" ||
          params.sendUpdates === "none"
            ? params.sendUpdates
            : "all",
      });
      return success(toolCallId, "create_event", data);
    } catch (err) {
      return failure(toolCallId, "create_event", err);
    }
  },

  get_availability: async (toolCallId, args, ctx) => {
    const params = parseJsonArgs(args);
    const timeMin = String(params.timeMin ?? "");
    const timeMax = String(params.timeMax ?? "");
    if (!timeMin || !timeMax) {
      return failure(toolCallId, "get_availability", new Error("timeMin and timeMax are required"));
    }
    try {
      const data = await ctx.calendarService.getAvailability(ctx.userId, {
        timeMin,
        timeMax,
        timeZone: typeof params.timeZone === "string" ? params.timeZone : undefined,
      });
      return success(toolCallId, "get_availability", data);
    } catch (err) {
      return failure(toolCallId, "get_availability", err);
    }
  },
};
