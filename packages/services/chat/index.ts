import OpenAI from "openai";
import { eq, desc } from "@repo/database";
import { db } from "@repo/database";
import {
  conversationsTable,
  chatMessagesTable,
  type SelectConversation,
  type SelectChatMessage,
} from "@repo/database/schema";
import { logger } from "@repo/logger";

import { env } from "../env";
import type GmailService from "../gmail";
import type CalendarService from "../calendar";
import type UserService from "../user";

import {
  sendMessageInputSchema,
  chatMessageSchema,
  type ChatMessage,
  type SendMessageInput,
  type SendMessageOutput,
  type ToolResult,
} from "./model";
import { tools, toolExecutorMap } from "./tools";
import { buildSystemPrompt } from "./prompt";
import { redactSecrets, sanitizeForLogging, truncateToolResult } from "./sanitize";
import { hasXMLToolCalls, parseXMLToolCalls } from "./xml-tools";

const ASSISTANT_ROLE = "assistant" as const;
const TOOL_ROLE = "tool" as const;

export interface ChatServiceDependencies {
  gmailService: GmailService;
  calendarService: CalendarService;
  userService: UserService;
  openAIClient?: OpenAI;
}

class ChatService {
  private readonly openai: OpenAI;
  private readonly gmailService: GmailService;
  private readonly calendarService: CalendarService;
  private readonly userService: UserService;

  constructor(deps: ChatServiceDependencies) {
    this.gmailService = deps.gmailService;
    this.calendarService = deps.calendarService;
    this.userService = deps.userService;
    this.openai =
      deps.openAIClient ??
      new OpenAI({
        apiKey: env.GLM_API_KEY,
        baseURL: env.GLM_BASE_URL,
        timeout: env.CHAT_LLM_TIMEOUT_MS,
        maxRetries: 2,
      });
  }

  /**
   * Send a chat message and get an assistant response.
   * Persists the conversation and all messages.
   */
  async sendMessage(userId: string, input: SendMessageInput): Promise<SendMessageOutput> {
    const {
      conversationId: inputConversationId,
      message,
      history,
    } = await sendMessageInputSchema.parseAsync(input);

    const userInfo = await this.userService.getUserInfoByID(userId);
    const userEmail = userInfo.email;

    let conversationId = inputConversationId;
    let isNewConversation = false;
    if (!conversationId) {
      const [conversation] = await db
        .insert(conversationsTable)
        .values({
          userId,
          title: "New chat",
          model: env.GLM_MODEL,
        })
        .returning({ id: conversationsTable.id });
      if (!conversation) throw new Error("Failed to create conversation");
      conversationId = conversation.id;
      isNewConversation = true;
      logger.info("Created new chat conversation", { userId, conversationId });
    } else {
      await this.verifyConversationOwnership(userId, conversationId);
    }

    // Only persist the new user message. The history parameter is accepted for
    // compatibility with stateless clients, but the database is the source of
    // truth for persisted conversations.
    await this.persistMessages(conversationId, [{ role: "user", content: message }]);

    // Generate a concise title for new conversations and update it in the
    // background so the conversation list shows intent instead of the raw message.
    const titleUpdatePromise = isNewConversation
      ? this.generateAndUpdateTitle(conversationId, message)
      : Promise.resolve();

    const messages = await this.buildLLMMessages(userId, conversationId, userEmail);

    logger.info("Sending chat message to LLM", {
      userId,
      conversationId,
      model: env.GLM_MODEL,
      messageCount: messages.length,
    });

    let currentMessages = messages;

    try {
      const MAX_TOOL_ROUNDS = 5;
      let finalContent = "";
      let finalToolCalls: ChatMessage["toolCalls"] | undefined;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await this.openai.chat.completions.create({
          model: env.GLM_MODEL,
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          temperature: 0.3,
        });

        const choice = response.choices[0];
        if (!choice) throw new Error("LLM returned no choices");

        const assistantMessage = choice.message;
        let assistantContent = assistantMessage.content ?? "";
        let assistantToolCalls: ChatMessage["toolCalls"] | undefined;

        // Some OpenAI-compatible providers emit tool calls as XML inside content.
        if (!assistantMessage.tool_calls?.length && hasXMLToolCalls(assistantContent)) {
          const parsed = parseXMLToolCalls(assistantContent);
          assistantContent = parsed.cleanedContent;
          assistantToolCalls = parsed.toolCalls;
        } else {
          assistantToolCalls = assistantMessage.tool_calls
            ?.filter(
              (tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall => tc.type === "function",
            )
            .map((tc) => {
              const toolCall = tc as OpenAI.Chat.ChatCompletionMessageToolCall & {
                function: { name: string; arguments: string };
              };
              return {
                id: toolCall.id,
                type: "function" as const,
                function: {
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments,
                },
              };
            });
        }

        await this.persistMessages(conversationId, [
          {
            role: ASSISTANT_ROLE,
            content: assistantContent,
            toolCalls: assistantToolCalls,
          },
        ]);

        if (!assistantToolCalls || assistantToolCalls.length === 0) {
          finalContent = assistantContent;
          finalToolCalls = undefined;
          break;
        }

        finalToolCalls = assistantToolCalls;
        const toolResults = await this.executeToolCalls(assistantToolCalls, userId);
        await this.persistToolResults(conversationId, toolResults);

        currentMessages = await this.buildLLMMessages(userId, conversationId, userEmail);
      }

      logger.info("Chat assistant response generated", {
        userId,
        conversationId,
        responseLength: finalContent.length,
      });

      // Wait for the title to be generated/updated before returning so the
      // conversation list reflects the intent on the next fetch.
      await titleUpdatePromise.catch((err) => {
        logger.warn("Conversation title update failed", {
          conversationId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return {
        conversationId,
        role: ASSISTANT_ROLE,
        content: finalContent,
        toolCalls: finalToolCalls,
      };
    } catch (err) {
      const safeError = redactSecrets(err instanceof Error ? err.message : String(err));
      logger.error("Chat assistant response failed", {
        userId,
        conversationId,
        error: safeError,
      });
      throw err;
    }
  }

  /**
   * List conversations for a user, ordered by most recently updated.
   */
  async listConversations(userId: string): Promise<SelectConversation[]> {
    return db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.userId, userId))
      .orderBy(desc(conversationsTable.updatedAt));
  }

  /**
   * Get a single conversation and its messages if the user owns it.
   */
  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ conversation: SelectConversation; messages: SelectChatMessage[] }> {
    await this.verifyConversationOwnership(userId, conversationId);

    const [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);
    if (!conversation) throw new Error("Conversation not found");

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, conversationId))
      .orderBy(chatMessagesTable.createdAt);

    return { conversation, messages };
  }

  /**
   * Delete a conversation and all its messages.
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await this.verifyConversationOwnership(userId, conversationId);
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.conversationId, conversationId));
    await db.delete(conversationsTable).where(eq(conversationsTable.id, conversationId));
    logger.info("Deleted chat conversation", { userId, conversationId });
  }

  /**
   * Ensure a conversation belongs to the requesting user.
   */
  private async verifyConversationOwnership(userId: string, conversationId: string): Promise<void> {
    const [conversation] = await db
      .select({ userId: conversationsTable.userId })
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversationId))
      .limit(1);

    if (!conversation) throw new Error("Conversation not found");
    if (conversation.userId !== userId) {
      logger.warn("Unauthorized chat conversation access attempt", {
        userId,
        conversationId,
        ownerId: conversation.userId,
      });
      throw new Error("Unauthorized");
    }
  }

  /**
   * Persist a batch of messages to the database.
   */
  private async persistMessages(
    conversationId: string,
    messages: Array<{
      role: ChatMessage["role"];
      content?: string;
      toolCalls?: ChatMessage["toolCalls"];
      toolCallId?: string;
      toolName?: string;
    }>,
  ): Promise<void> {
    if (messages.length === 0) return;

    const values = messages.map((m) => ({
      conversationId,
      role: m.role,
      content: m.content ?? null,
      toolCalls: m.toolCalls ? JSON.stringify(m.toolCalls) : null,
      toolCallId: m.toolCallId ?? null,
      toolName: m.toolName ?? null,
    }));

    await db.insert(chatMessagesTable).values(values);
  }

  /**
   * Persist tool results as tool-role messages.
   */
  private async persistToolResults(conversationId: string, results: ToolResult[]): Promise<void> {
    if (results.length === 0) return;

    await db.insert(chatMessagesTable).values(
      results.map((r) => ({
        conversationId,
        role: TOOL_ROLE,
        content: truncateToolResult(r.content),
        toolCallId: r.toolCallId,
        toolName: r.toolName,
      })),
    );
  }

  /**
   * Build the message list to send to the LLM from the system prompt and
   * the most recent persisted messages.
   */
  private async buildLLMMessages(
    userId: string,
    conversationId: string,
    userEmail: string,
  ): Promise<OpenAI.ChatCompletionMessageParam[]> {
    const userInfo = await this.userService.getUserInfoByID(userId);
    const systemPrompt = buildSystemPrompt({
      userEmail,
      userName: userInfo.fullName,
      today: new Date().toISOString(),
    });

    const persistedMessages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversationId, conversationId))
      .orderBy(chatMessagesTable.createdAt)
      .limit(env.CHAT_MAX_HISTORY_MESSAGES);

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const m of persistedMessages) {
      const validated = await chatMessageSchema.safeParseAsync({
        role: m.role,
        content: m.content ?? undefined,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls) : undefined,
        toolCallId: m.toolCallId ?? undefined,
        toolName: m.toolName ?? undefined,
      });

      if (!validated.success) {
        logger.warn("Skipping malformed persisted chat message", {
          conversationId,
          messageId: m.id,
          error: validated.error.message,
        });
        continue;
      }

      messages.push(this.toOpenAIMessage(validated.data));
    }

    return messages;
  }

  /**
   * Convert an internal ChatMessage to an OpenAI message param.
   */
  private toOpenAIMessage(message: ChatMessage): OpenAI.ChatCompletionMessageParam {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: truncateToolResult(message.content ?? ""),
        tool_call_id: message.toolCallId ?? "",
      };
    }

    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.toolCalls.map((tc) => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }

    return {
      role: message.role,
      content: message.content ?? "",
    };
  }

  /**
   * Execute tool calls emitted by the assistant.
   */
  private async executeToolCalls(
    toolCalls: NonNullable<ChatMessage["toolCalls"]>,
    userId: string,
  ): Promise<ToolResult[]> {
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const executor = toolExecutorMap[tc.function.name];
        if (!executor) {
          logger.warn("Unknown tool call requested", {
            userId,
            toolName: tc.function.name,
            toolCallId: tc.id,
          });
          return {
            toolCallId: tc.id,
            toolName: tc.function.name,
            content: `Error: Unknown tool "${tc.function.name}"`,
            error: true,
          };
        }

        logger.info("Executing chat tool", {
          userId,
          toolName: tc.function.name,
          toolCallId: tc.id,
        });

        try {
          const result = await executor(tc.id, tc.function.arguments, {
            userId,
            gmailService: this.gmailService,
            calendarService: this.calendarService,
          });

          logger.info("Chat tool executed", {
            userId,
            toolName: tc.function.name,
            toolCallId: tc.id,
            error: result.error,
            contentPreview: sanitizeForLogging(result.content),
          });

          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("Chat tool execution threw", {
            userId,
            toolName: tc.function.name,
            toolCallId: tc.id,
            error: redactSecrets(message),
          });
          return {
            toolCallId: tc.id,
            toolName: tc.function.name,
            content: `Error: ${redactSecrets(message)}`,
            error: true,
          };
        }
      }),
    );

    return results;
  }

  /**
   * Generate a short, intent-based title for a new conversation based on the
   * first user message. Falls back to "New chat" if generation fails.
   */
  private async generateConversationTitle(message: string): Promise<string> {
    const trimmed = message.trim();
    if (!trimmed) return "New chat";

    logger.info("Generating conversation title", { messagePreview: trimmed.slice(0, 100) });

    try {
      const response = await this.openai.chat.completions.create(
        {
          model: env.GLM_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You generate concise conversation titles. Given a user's first message, output a 3-6 word title describing their intent. Do not explain, quote, or include markdown." +
                "\nExample input: 'show my next meeting'\nExample output: View next meeting" +
                "\nExample input: 'draft an email to john about the proposal'\nExample output: Draft proposal email" +
                "\nOutput only the title.",
            },
            { role: "user", content: trimmed },
          ],
          temperature: 0.1,
          max_tokens: 50,
        },
        { signal: AbortSignal.timeout(5000) },
      );

      const rawTitle = response.choices[0]?.message?.content?.trim();
      logger.info("Received conversation title candidate", { rawTitle });

      if (rawTitle) {
        // Remove surrounding quotes, "Title:", and markdown; trim to DB column length
        const cleaned = rawTitle
          .replace(/^(title|"|')\s*:?\s*/i, "")
          .replace(/["']$/g, "")
          .replace(/^["']/, "")
          .replace(/\*\*/g, "")
          .trim()
          .slice(0, 200);
        if (cleaned) return cleaned;
      }
    } catch (err) {
      logger.warn("Failed to generate conversation title", {
        error: err instanceof Error ? redactSecrets(err.message) : String(err),
      });
    }

    // Fallback: derive a readable title from the first user message
    const fallback = trimmed
      .split(/\s+/)
      .slice(0, 6)
      .join(" ")
      .replace(/[\p{P}\p{S}]+$/u, "")
      .slice(0, 200);
    return fallback || "New chat";
  }

  /**
   * Generate a title for a new conversation and update the row.
   */
  private async generateAndUpdateTitle(conversationId: string, message: string): Promise<void> {
    const title = await this.generateConversationTitle(message);
    await db
      .update(conversationsTable)
      .set({ title })
      .where(eq(conversationsTable.id, conversationId));
    logger.info("Updated conversation title", { conversationId, title });
  }
}

export default ChatService;
