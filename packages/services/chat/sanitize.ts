import { env } from "../env";

const API_KEY_REDACTION = "***REDACTED***";

/**
 * Redact sensitive values from a string. Used before logging or returning
 * content to the client to avoid leaking API keys, tokens, or secrets.
 */
export function redactSecrets(input: string): string {
  if (!input) return input;

  const patterns: { pattern: RegExp; replacement: string }[] = [
    {
      pattern: /(Authorization[:\s]+Bearer\s+)[\w-._~+/]+/gi,
      replacement: `$1${API_KEY_REDACTION}`,
    },
    {
      pattern: /(api[_-]?key[:\s=]+)["']?[\w-._~+/]+["']?/gi,
      replacement: `$1${API_KEY_REDACTION}`,
    },
    {
      pattern: /(CORSAIR_KEK|GLM_API_KEY|JWT_SECRET|GOOGLE_OAUTH_CLIENT_SECRET)=[^\s&,"}]*/gi,
      replacement: `$1=${API_KEY_REDACTION}`,
    },
    {
      pattern: /("(?:apiKey|api_key|glm_api_key|jwt_secret|corsair_kek)":\s*")[^"]+"/gi,
      replacement: `$1${API_KEY_REDACTION}"`,
    },
  ];

  return patterns.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    input,
  );
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(input: string, maxLength: number): string {
  if (!input || input.length <= maxLength) return input;
  return `${input.slice(0, maxLength)}… [truncated, ${input.length - maxLength} chars omitted]`;
}

/**
 * Truncate tool results to keep prompt sizes bounded and avoid exceeding
 * context-window or latency limits.
 */
export function truncateToolResult(input: string): string {
  return truncate(input, env.CHAT_MAX_TOOL_RESULT_LENGTH);
}

/**
 * Sanitize an arbitrary value for safe logging by serializing and redacting.
 */
export function sanitizeForLogging(value: unknown): string {
  try {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    return redactSecrets(truncate(serialized, 2000));
  } catch {
    return "[unserializable]";
  }
}
