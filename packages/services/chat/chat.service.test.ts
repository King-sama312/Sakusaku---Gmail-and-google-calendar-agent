import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatService from "./index";
import type GmailService from "../gmail";
import type CalendarService from "../calendar";
import type UserService from "../user";
import type { OpenAI } from "openai";

const conversationsTableMarker = vi.hoisted(() => ({
  id: { name: "id" },
  userId: { name: "userId" },
  title: { name: "title" },
  model: { name: "model" },
  createdAt: { name: "createdAt" },
  updatedAt: { name: "updatedAt" },
}));

const messagesTableMarker = vi.hoisted(() => ({
  id: { name: "id" },
  conversationId: { name: "conversationId" },
  role: { name: "role" },
  content: { name: "content" },
  toolCalls: { name: "toolCalls" },
  toolCallId: { name: "toolCallId" },
  toolName: { name: "toolName" },
  createdAt: { name: "createdAt" },
}));

const inMemoryDb = vi.hoisted(() => {
  const conversations: Array<{
    id: string;
    userId: string;
    title: string;
    model: string;
    createdAt: Date;
    updatedAt: Date | null;
  }> = [];

  const messages: Array<{
    id: string;
    conversationId: string;
    role: string;
    content: string | null;
    toolCalls: string | null;
    toolCallId: string | null;
    toolName: string | null;
    createdAt: Date;
  }> = [];

  let idCounter = 0;
  function nextId() {
    idCounter += 1;
    // Generate deterministic valid UUIDs for tests
    return `00000000-0000-1000-8000-${String(idCounter).padStart(12, "0")}`;
  }

  function reset() {
    conversations.length = 0;
    messages.length = 0;
    idCounter = 0;
  }

  function matchesPredicate(
    row: Record<string, unknown>,
    predicate: Record<string, unknown> | ((r: Record<string, unknown>) => boolean),
  ): boolean {
    if (typeof predicate === "function") return predicate(row);
    if (predicate.type === "eq") {
      const col = predicate.column as Record<string, unknown>;
      const key = String(col.name ?? "");
      return row[key] === predicate.value;
    }
    return true;
  }

  function createSelectChain() {
    let currentTable: unknown = null;
    let predicates: Array<Record<string, unknown> | ((r: Record<string, unknown>) => boolean)> = [];
    let limitValue: number | null = null;
    let orderValue: { direction: string } | null = null;

    const chain = {
      from: (table: unknown) => {
        currentTable = table;
        return chain;
      },
      where: (predicate: unknown) => {
        predicates.push(predicate as Record<string, unknown>);
        return chain;
      },
      orderBy: (value: unknown) => {
        orderValue = value as { direction: string };
        return chain;
      },
      limit: (n: number) => {
        limitValue = n;
        return chain;
      },
      then: async (resolve: (value: unknown[]) => void) => {
        let data: Record<string, unknown>[] = [];
        if (currentTable === conversationsTableMarker) {
          data = conversations.map((c) => ({ ...c }));
        } else if (currentTable === messagesTableMarker) {
          data = messages.map((m) => ({ ...m }));
        }
        if (predicates.length > 0) {
          data = data.filter((row) => predicates.every((p) => matchesPredicate(row, p)));
        }
        if (orderValue?.direction === "desc") {
          data = data.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        } else {
          data = data.sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
        }
        if (limitValue !== null) {
          data = data.slice(0, limitValue);
        }
        resolve(data);
        return data;
      },
    };
    return chain;
  }

  function createInsertChain(table: unknown) {
    return {
      values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        const created = rowArray.map((row) => {
          const id = nextId();
          if (table === conversationsTableMarker) {
            const item = {
              id,
              userId: String(row.userId),
              title: String(row.title),
              model: String(row.model),
              createdAt: new Date(),
              updatedAt: null,
            };
            conversations.push(item);
            return { id };
          }
          const item = {
            id,
            conversationId: String(row.conversationId),
            role: String(row.role),
            content: row.content ? String(row.content) : null,
            toolCalls: row.toolCalls ? String(row.toolCalls) : null,
            toolCallId: row.toolCallId ? String(row.toolCallId) : null,
            toolName: row.toolName ? String(row.toolName) : null,
            createdAt: new Date(),
          };
          messages.push(item);
          return { ...item };
        });
        return {
          returning: () => Promise.resolve(created),
        };
      },
    };
  }

  function createDeleteChain(table: unknown) {
    return {
      where: (predicate: unknown) => ({
        then: async (resolve: () => void) => {
          const pred = predicate as Record<string, unknown>;
          if (table === messagesTableMarker) {
            for (let i = messages.length - 1; i >= 0; i--) {
              if (matchesPredicate(messages[i]!, pred)) {
                messages.splice(i, 1);
              }
            }
          } else if (table === conversationsTableMarker) {
            for (let i = conversations.length - 1; i >= 0; i--) {
              if (matchesPredicate(conversations[i]!, pred)) {
                conversations.splice(i, 1);
              }
            }
          }
          resolve();
        },
      }),
    };
  }

  function createUpdateChain(table: unknown) {
    return {
      set: (values: Record<string, unknown>) => ({
        where: (predicate: unknown) => {
          const pred = predicate as Record<string, unknown>;

          async function executeUpdate(): Promise<Record<string, unknown>[]> {
            const updated: Record<string, unknown>[] = [];
            if (table === conversationsTableMarker) {
              for (const row of conversations) {
                if (matchesPredicate(row, pred)) {
                  Object.assign(row, values);
                  updated.push({ ...row });
                }
              }
            } else if (table === messagesTableMarker) {
              for (const row of messages) {
                if (matchesPredicate(row, pred)) {
                  Object.assign(row, values);
                  updated.push({ ...row });
                }
              }
            }
            return updated;
          }

          const thenable = {
            returning: () => ({
              then: async (resolve: (value: unknown[]) => void) => {
                const result = await executeUpdate();
                resolve(result);
                return result;
              },
            }),
            then: async (resolve: (value: unknown[]) => void) => {
              const result = await executeUpdate();
              resolve(result);
              return result;
            },
          };

          return thenable;
        },
      }),
    };
  }

  return {
    conversations,
    messages,
    reset,
    createSelectChain,
    createInsertChain,
    createDeleteChain,
    createUpdateChain,
  };
});

vi.mock("@repo/database", () => {
  function eq(column: Record<string, unknown>, value: unknown) {
    return { type: "eq", column, value };
  }

  function desc() {
    return { direction: "desc" };
  }

  return {
    eq,
    desc,
    db: {
      select: () => inMemoryDb.createSelectChain(),
      insert: (table: unknown) => inMemoryDb.createInsertChain(table),
      delete: (table: unknown) => inMemoryDb.createDeleteChain(table),
      update: (table: unknown) => inMemoryDb.createUpdateChain(table),
    },
  };
});

vi.mock("@repo/database/schema", () => ({
  conversationsTable: conversationsTableMarker,
  chatMessagesTable: messagesTableMarker,
}));

function createMockOpenAI(responses: OpenAI.Chat.ChatCompletion[]) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => {
          const response = responses.shift();
          if (!response) throw new Error("No more mock responses");
          return response;
        }),
      },
    },
  } as unknown as OpenAI;
}

function createChatCompletion(content: string): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Date.now(),
    model: "glm-4",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
  } as OpenAI.Chat.ChatCompletion;
}

function createToolCompletion(
  toolName: string,
  args: Record<string, unknown>,
): OpenAI.Chat.ChatCompletion {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: Date.now(),
    model: "glm-4",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: {
                name: toolName,
                arguments: JSON.stringify(args),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  } as OpenAI.Chat.ChatCompletion;
}

function createTitleCompletion(title: string): OpenAI.Chat.ChatCompletion {
  return createChatCompletion(title);
}

describe("ChatService", () => {
  beforeEach(() => {
    inMemoryDb.reset();
  });

  it("creates a new conversation and returns assistant response", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Greeting"),
      createChatCompletion("Hello! How can I help?"),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;
    const gmailService = { listThreads: vi.fn() } as unknown as GmailService;
    const calendarService = {} as unknown as CalendarService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService,
      calendarService,
    });
    const result = await service.sendMessage("u1", { message: "Hi" });

    expect(result.content).toBe("Hello! How can I help?");
    expect(result.role).toBe("assistant");
    expect(inMemoryDb.conversations).toHaveLength(1);
    expect(inMemoryDb.conversations[0]?.title).toBe("Greeting");
    expect(inMemoryDb.messages).toHaveLength(2);
  });

  it("falls back to a truncated first message when title generation returns empty", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion(""),
      createChatCompletion("Hello! How can I help?"),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;
    const gmailService = { listThreads: vi.fn() } as unknown as GmailService;
    const calendarService = {} as unknown as CalendarService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService,
      calendarService,
    });
    const result = await service.sendMessage("u1", {
      message: "Help me schedule a meeting with the engineering team tomorrow",
    });

    expect(result.content).toBe("Hello! How can I help?");
    expect(inMemoryDb.conversations[0]?.title).toBe("Help me schedule a meeting with");
  });

  it("executes tool calls and sends results back to the LLM", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Inbox search"),
      createToolCompletion("list_threads", { q: "from:boss" }),
      createChatCompletion("I found 0 threads from boss."),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;
    const gmailService = {
      listThreads: vi.fn().mockResolvedValue({ threads: [], resultSizeEstimate: 0 }),
    } as unknown as GmailService;
    const calendarService = {} as unknown as CalendarService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService,
      calendarService,
    });
    const result = await service.sendMessage("u1", { message: "Any emails from boss?" });

    expect(gmailService.listThreads).toHaveBeenCalledWith("u1", { q: "from:boss", maxResults: 20 });
    expect(result.content).toBe("I found 0 threads from boss.");
    expect(inMemoryDb.messages.filter((m) => m.role === "tool")).toHaveLength(1);
  });

  it("reuses an existing conversation when conversationId is provided", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Greeting"),
      createChatCompletion("Got it."),
      createChatCompletion("Still here."),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;
    const gmailService = {} as unknown as GmailService;
    const calendarService = {} as unknown as CalendarService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService,
      calendarService,
    });
    const first = await service.sendMessage("u1", { message: "Hi" });
    const second = await service.sendMessage("u1", {
      conversationId: first.conversationId,
      message: "Again",
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(inMemoryDb.conversations).toHaveLength(1);
  });

  it("lists conversations for a user", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Greeting"),
      createChatCompletion("Hi"),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService: {} as GmailService,
      calendarService: {} as CalendarService,
    });
    await service.sendMessage("u1", { message: "Hello" });

    const list = await service.listConversations("u1");
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe("u1");
    expect(list[0]?.title).toBe("Greeting");
  });

  it("deletes a conversation and its messages", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Greeting"),
      createChatCompletion("Hi"),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService: {} as GmailService,
      calendarService: {} as CalendarService,
    });
    const { conversationId } = await service.sendMessage("u1", { message: "Hello" });
    expect(inMemoryDb.messages.length).toBeGreaterThan(0);

    await service.deleteConversation("u1", conversationId);
    expect(inMemoryDb.conversations).toHaveLength(0);
    expect(inMemoryDb.messages).toHaveLength(0);
  });

  it("throws when a user tries to access another user's conversation", async () => {
    const openai = createMockOpenAI([
      createTitleCompletion("Greeting"),
      createChatCompletion("Hi"),
    ]);
    const userService = {
      getUserInfoByID: vi.fn().mockResolvedValue({ email: "user@example.com", fullName: "User" }),
    } as unknown as UserService;

    const service = new ChatService({
      openAIClient: openai,
      userService,
      gmailService: {} as GmailService,
      calendarService: {} as CalendarService,
    });
    const { conversationId } = await service.sendMessage("u1", { message: "Hello" });

    await expect(service.getConversation("u2", conversationId)).rejects.toThrow("Unauthorized");
  });
});
