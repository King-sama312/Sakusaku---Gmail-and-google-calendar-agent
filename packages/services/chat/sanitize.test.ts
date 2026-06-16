import { describe, it, expect } from "vitest";
import { redactSecrets, truncate, truncateToolResult, sanitizeForLogging } from "./sanitize";

describe("sanitize", () => {
  it("redacts Authorization headers", () => {
    const input = "Authorization: Bearer super-secret-token";
    expect(redactSecrets(input)).toBe("Authorization: Bearer ***REDACTED***");
  });

  it("redacts API keys", () => {
    const input = "api-key=super-secret";
    expect(redactSecrets(input)).toContain("***REDACTED***");
  });

  it("redacts sensitive env vars", () => {
    const input = "GLM_API_KEY=sk-123 CORSAIR_KEK=kek JWT_SECRET=secret";
    const output = redactSecrets(input);
    expect(output).not.toContain("sk-123");
    expect(output).not.toContain("kek");
    expect(output).not.toContain("secret");
  });

  it("truncates long strings", () => {
    const input = "a".repeat(100);
    expect(truncate(input, 50).length).toBeLessThan(input.length);
    expect(truncate(input, 50)).toContain("…");
  });

  it("does not truncate short strings", () => {
    const input = "short";
    expect(truncate(input, 50)).toBe(input);
  });

  it("truncates tool results", () => {
    const input = "x".repeat(10000);
    expect(truncateToolResult(input).length).toBeLessThan(input.length);
  });

  it("sanitizes objects for logging", () => {
    const output = sanitizeForLogging({ apiKey: "secret" });
    expect(output).toContain("***REDACTED***");
  });
});
