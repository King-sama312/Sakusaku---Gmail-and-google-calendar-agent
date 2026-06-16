import { describe, it, expect } from "vitest";
import {
  formatListThreadsResult,
  formatGetThreadResult,
  formatSendEmailResult,
  formatCreateEventResult,
} from "./formatters";

function encodeBase64Url(text: string): string {
  return Buffer.from(text)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("formatters", () => {
  it("formats list_threads result", () => {
    const result = formatListThreadsResult({
      threads: [
        { id: "t1", snippet: "Hello from Alice" },
        { id: "t2", snippet: "Meeting tomorrow" },
      ],
    });

    expect(result).toContain("Found 2 thread(s)");
    expect(result).toContain("Hello from Alice");
    expect(result).toContain("Meeting tomorrow");
  });

  it("formats get_thread result with decoded body", () => {
    const bodyText = "This is the email body.";
    const result = formatGetThreadResult({
      id: "th1",
      messages: [
        {
          id: "m1",
          snippet: "snippet text",
          payload: {
            mimeType: "multipart/alternative",
            headers: [
              { name: "From", value: "alice@example.com" },
              { name: "Subject", value: "Hello" },
              { name: "Date", value: "Tue, 16 Jun 2026" },
            ],
            parts: [
              {
                mimeType: "text/plain",
                body: { data: encodeBase64Url(bodyText) },
              },
            ],
          },
        },
      ],
    });

    expect(result).toContain("From: alice@example.com");
    expect(result).toContain("Subject: Hello");
    expect(result).toContain("Date: Tue, 16 Jun 2026");
    expect(result).toContain(bodyText);
  });

  it("falls back to snippet when no text part exists", () => {
    const result = formatGetThreadResult({
      messages: [
        {
          id: "m1",
          snippet: "This is the snippet fallback.",
          payload: {
            mimeType: "text/html",
            headers: [{ name: "Subject", value: "No plain text" }],
            body: { data: encodeBase64Url("<p>html body</p>") },
          },
        },
      ],
    });

    expect(result).toContain("This is the snippet fallback.");
  });

  it("formats send_email result", () => {
    const result = formatSendEmailResult({ id: "m1", threadId: "t1" });
    expect(result).toContain("Email sent");
    expect(result).toContain("m1");
  });

  it("formats create_event result", () => {
    const result = formatCreateEventResult({ id: "e1", summary: "Team sync" });
    expect(result).toContain("Event created");
    expect(result).toContain("Team sync");
  });
});
