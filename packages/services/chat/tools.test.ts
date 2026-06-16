import { describe, it, expect, vi } from "vitest";
import { toolExecutorMap } from "./tools";
import type GmailService from "../gmail";
import type CalendarService from "../calendar";

function createMockServices() {
  return {
    gmailService: {
      listThreads: vi.fn().mockResolvedValue({ threads: [{ id: "t1", snippet: "hello" }] }),
      getThread: vi.fn().mockResolvedValue({ id: "t1", messages: [] }),
      sendMessage: vi.fn().mockResolvedValue({ id: "m1", threadId: "t1" }),
      createDraft: vi.fn().mockResolvedValue({ id: "d1" }),
    } as unknown as GmailService,
    calendarService: {
      listEvents: vi.fn().mockResolvedValue({ items: [] }),
      createEvent: vi.fn().mockResolvedValue({ id: "e1" }),
      getAvailability: vi.fn().mockResolvedValue({ calendars: {} }),
    } as unknown as CalendarService,
  };
}

describe("toolExecutorMap", () => {
  it("list_threads calls gmailService.listThreads with defaults", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.list_threads("tc-1", JSON.stringify({ q: "from:test" }), {
      userId: "u1",
      gmailService,
      calendarService,
    });

    expect(gmailService.listThreads).toHaveBeenCalledWith("u1", { q: "from:test", maxResults: 20 });
    expect(result.error).toBe(false);
    expect(result.toolCallId).toBe("tc-1");
  });

  it("list_threads clamps maxResults", async () => {
    const { gmailService, calendarService } = createMockServices();
    await toolExecutorMap.list_threads("tc-1", JSON.stringify({ maxResults: 999 }), {
      userId: "u1",
      gmailService,
      calendarService,
    });

    expect(gmailService.listThreads).toHaveBeenCalledWith("u1", {
      q: undefined,
      maxResults: 50,
    });
  });

  it("get_thread validates required id", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.get_thread("tc-1", JSON.stringify({}), {
      userId: "u1",
      gmailService,
      calendarService,
    });

    expect(result.error).toBe(true);
    expect(result.content).toContain("Thread ID is required");
  });

  it("send_email validates required fields", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.send_email(
      "tc-1",
      JSON.stringify({ to: "a@b.com", subject: "" }),
      { userId: "u1", gmailService, calendarService },
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain("to, subject, and body are required");
  });

  it("send_email sends message on valid input", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.send_email(
      "tc-1",
      JSON.stringify({ to: "a@b.com", subject: "Hi", body: "Hello" }),
      { userId: "u1", gmailService, calendarService },
    );

    expect(gmailService.sendMessage).toHaveBeenCalledWith("u1", {
      to: "a@b.com",
      subject: "Hi",
      body: "Hello",
      cc: undefined,
    });
    expect(result.error).toBe(false);
  });

  it("create_event validates required fields", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.create_event(
      "tc-1",
      JSON.stringify({ summary: "Meeting" }),
      { userId: "u1", gmailService, calendarService },
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain("summary, start, and end are required");
  });

  it("create_event creates event with attendees", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.create_event(
      "tc-1",
      JSON.stringify({
        summary: "Meeting",
        start: "2026-06-20T14:00:00+05:30",
        end: "2026-06-20T15:00:00+05:30",
        timeZone: "Asia/Kolkata",
        attendees: ["a@b.com"],
      }),
      { userId: "u1", gmailService, calendarService },
    );

    expect(calendarService.createEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        summary: "Meeting",
        start: { dateTime: "2026-06-20T14:00:00+05:30", timeZone: "Asia/Kolkata" },
        end: { dateTime: "2026-06-20T15:00:00+05:30", timeZone: "Asia/Kolkata" },
        attendees: [{ email: "a@b.com" }],
      }),
    );
    expect(result.error).toBe(false);
  });

  it("get_availability validates required fields", async () => {
    const { gmailService, calendarService } = createMockServices();
    const result = await toolExecutorMap.get_availability("tc-1", JSON.stringify({}), {
      userId: "u1",
      gmailService,
      calendarService,
    });

    expect(result.error).toBe(true);
    expect(result.content).toContain("timeMin and timeMax are required");
  });

  it("returns failure on service exception", async () => {
    const { gmailService, calendarService } = createMockServices();
    vi.mocked(gmailService.listThreads).mockRejectedValue(new Error("Gmail is down"));

    const result = await toolExecutorMap.list_threads("tc-1", JSON.stringify({}), {
      userId: "u1",
      gmailService,
      calendarService,
    });

    expect(result.error).toBe(true);
    expect(result.content).toContain("Gmail is down");
  });
});
