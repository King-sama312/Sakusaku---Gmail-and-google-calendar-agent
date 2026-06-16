/**
 * Email MIME decoding utilities for parsing Gmail API responses.
 */

export interface EmailHeaders {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  date?: string;
  [key: string]: string | undefined;
}

export interface EmailContent {
  textPlain?: string;
  textHtml?: string;
}

export interface ParsedEmail {
  headers: EmailHeaders;
  content: EmailContent;
  snippet?: string;
}

/**
 * Decode base64url encoded string (Gmail's encoding format).
 * Uses browser-compatible atob instead of Node.js Buffer.
 */
export function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  try {
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
  } catch {
    return "";
  }
}

/**
 * Extract headers from a message payload into a key-value object.
 * Preserves original case (e.g., "From", "Subject") and adds lowercase versions.
 */
export function extractHeaders(
  payload: Record<string, unknown>,
): EmailHeaders {
  const headers = payload.headers as
    | Array<{ name?: string; value?: string }>
    | undefined;
  const result: EmailHeaders = {};
  if (!Array.isArray(headers)) return result;

  for (const header of headers) {
    if (header.name && header.value) {
      // Store with original case
      result[header.name] = header.value;
      // Also store lowercase for easy access
      result[header.name.toLowerCase()] = header.value;
    }
  }
  return result;
}

/**
 * Recursively find text/plain and text/html parts in MIME payload.
 */
export function findContentParts(
  payload: Record<string, unknown>,
): EmailContent {
  const result: EmailContent = {};

  function search(part: Record<string, unknown>) {
    const mimeType = part.mimeType as string | undefined;
    const body = part.body as { data?: string } | undefined;

    if (mimeType === "text/plain" && body?.data && !result.textPlain) {
      result.textPlain = base64UrlDecode(body.data);
    }

    if (mimeType === "text/html" && body?.data && !result.textHtml) {
      result.textHtml = base64UrlDecode(body.data);
    }

    // Search in parts array (multipart messages)
    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(parts)) {
      for (const childPart of parts) {
        search(childPart);
        if (result.textPlain && result.textHtml) break;
      }
    }
  }

  search(payload);
  return result;
}

/**
 * Strip HTML tags and normalize whitespace for plain text display.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse a Gmail API message into structured email data.
 */
export function parseMessage(message: Record<string, unknown>): ParsedEmail {
  const payload = (message.payload as Record<string, unknown>) ?? {};

  // Debug: log the payload structure (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("Email payload:", {
      hasPayload: !!message.payload,
      payloadKeys: Object.keys(payload),
      hasHeaders: !!payload.headers,
      hasBody: !!payload.body,
      hasParts: !!payload.parts,
    });
  }

  const headers = extractHeaders(payload);
  const content = findContentParts(payload);
  const snippet = message.snippet as string | undefined;

  return {
    headers,
    content,
    snippet,
  };
}

/**
 * Get the best display text from parsed email content.
 * Prefers plain text, falls back to stripped HTML, then snippet.
 */
export function getEmailBodyText(parsed: ParsedEmail): string {
  if (parsed.content.textPlain) {
    return parsed.content.textPlain;
  }
  if (parsed.content.textHtml) {
    return stripHtml(parsed.content.textHtml);
  }
  return parsed.snippet || "(no content)";
}
