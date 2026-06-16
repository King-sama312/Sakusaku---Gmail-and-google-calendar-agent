/**
 * Format raw Corsair / Gmail / Calendar API responses into compact,
 * human-readable text before sending them back to the LLM.
 *
 * This avoids dumping huge JSON blobs (e.g. full MIME payloads) into the
 * context window and makes it much easier for the model to summarize or
 * reason about the data.
 */

const MAX_BODY_CHARS = 2000;
const MAX_SNIPPET_CHARS = 300;

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  try {
    return Buffer.from(padded, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function findTextPart(
  payload: Record<string, unknown>,
): { mimeType?: string; body?: { data?: string } } | null {
  if (
    payload.mimeType === "text/plain" &&
    typeof (payload.body as { data?: string })?.data === "string"
  ) {
    return payload as { mimeType: string; body: { data: string } };
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (part.mimeType === "text/plain") {
      return part as { mimeType: string; body: { data: string } };
    }
  }

  // Fallback to first part with a body
  for (const part of parts) {
    if (typeof (part.body as { data?: string })?.data === "string") {
      return part as { mimeType: string; body: { data: string } };
    }
  }

  return null;
}

function extractHeaders(payload: Record<string, unknown>): Record<string, string> {
  const headers = payload.headers as Array<{ name?: string; value?: string }> | undefined;
  const result: Record<string, string> = {};
  if (!Array.isArray(headers)) return result;

  for (const header of headers) {
    if (header.name && header.value) {
      result[header.name] = header.value;
    }
  }
  return result;
}

function truncate(input: string, maxLength: number): string {
  if (!input || input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}… [${input.length - maxLength} more chars]`;
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMessage(message: Record<string, unknown>, index: number): string {
  const payload = (message.payload as Record<string, unknown>) ?? {};
  const headers = extractHeaders(payload);
  const from = headers.From ?? headers.from ?? "Unknown sender";
  const subject = headers.Subject ?? headers.subject ?? "(no subject)";
  const date = headers.Date ?? headers.date ?? "Unknown date";
  const snippet = typeof message.snippet === "string" ? message.snippet : "";

  const textPart = findTextPart(payload);
  let body = "";
  if (textPart?.body?.data) {
    const decoded = base64UrlDecode(textPart.body.data);
    body = textPart.mimeType === "text/html" ? stripHtml(decoded) : decoded;
  }

  const bodyText = body || snippet;

  return [
    `--- Message ${index + 1} ---`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `Date: ${date}`,
    "",
    truncate(bodyText, MAX_BODY_CHARS),
  ].join("\n");
}

export function formatGetThreadResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "No thread data";
  const thread = data as Record<string, unknown>;
  const messages = (thread.messages as Array<Record<string, unknown>>) ?? [];

  if (messages.length === 0) return "Thread contains no messages.";

  const formattedMessages = messages.map((m, i) => formatMessage(m, i)).join("\n\n");

  return `Thread: ${messages[0]?.id ?? thread.id ?? "unknown"}\n\n${formattedMessages}`;
}

export function formatListThreadsResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "No threads found.";
  const result = data as Record<string, unknown>;
  const threads = (result.threads as Array<Record<string, unknown>>) ?? [];

  if (threads.length === 0) return "No threads found.";

  const lines = threads.map((t, i) => {
    const snippet = typeof t.snippet === "string" ? truncate(t.snippet, MAX_SNIPPET_CHARS) : "";
    return `${i + 1}. ${snippet || "(no preview)"} [id: ${t.id ?? "unknown"}]`;
  });

  return [`Found ${threads.length} thread(s):`, "", ...lines].join("\n");
}

export function formatListEventsResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "No events found.";
  const result = data as Record<string, unknown>;
  const events = (result.items as Array<Record<string, unknown>>) ?? [];

  if (events.length === 0) return "No events found.";

  const lines = events.map((e, i) => {
    const summary = typeof e.summary === "string" ? e.summary : "(no title)";
    const start = JSON.stringify(e.start);
    const end = JSON.stringify(e.end);
    return `${i + 1}. ${summary} | start: ${start} | end: ${end}`;
  });

  return [`Found ${events.length} event(s):`, "", ...lines].join("\n");
}

export function formatCreateEventResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Event created.";
  const event = data as Record<string, unknown>;
  return `Event created: ${event.summary ?? "(no title)"} (id: ${event.id ?? "unknown"})`;
}

export function formatSendEmailResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Email sent.";
  const message = data as Record<string, unknown>;
  return `Email sent (id: ${message.id ?? "unknown"}, thread: ${message.threadId ?? "unknown"}).`;
}

export function formatGetAvailabilityResult(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Availability checked.";
  return `Availability result:\n${JSON.stringify(data, null, 2)}`;
}

export function formatToolResult(toolName: string, data: unknown): string {
  switch (toolName) {
    case "list_threads":
      return formatListThreadsResult(data);
    case "get_thread":
      return formatGetThreadResult(data);
    case "list_events":
      return formatListEventsResult(data);
    case "create_event":
      return formatCreateEventResult(data);
    case "send_email":
      return formatSendEmailResult(data);
    case "get_availability":
      return formatGetAvailabilityResult(data);
    default:
      return typeof data === "string" ? data : JSON.stringify(data);
  }
}
