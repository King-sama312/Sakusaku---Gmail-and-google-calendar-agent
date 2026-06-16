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
    if (!conversationId) {
      const title = await this.generateConversationTitle(message);
      const [conversation] = await db
        .insert(conversationsTable)
        .values({
          userId,
          title,
          model: env.GLM_MODEL,
        })
        .returning({ id: conversationsTable.id });
      if (!conversation) throw new Error("Failed to create conversation");
      conversationId = conversation.id;
      logger.info("Created new chat conversation", { userId, conversationId, title });
    } else {
      await this.verifyConversationOwnership(userId, conversationId);
    }

    // Only persist the new user message. The history parameter is accepted for
    // compatibility with stateless clients, but the database is the source of
    // truth for persisted conversations.
    await this.persistMessages(conversationId, [{ role: "user", content: message }]);

    const messages = await this.buildLLMMessages(userId, conversationId, userEmail);

    logger.info("Sending chat message to LLM", {
      userId,
      conversationId,
      model: env.GLM_MODEL,
      messageCount: messages.length,
    });

    let assistantContent: string;
    let assistantToolCalls: ChatMessage["toolCalls"] | undefined;

    try {
      const firstResponse = await this.openai.chat.completions.create({
        model: env.GLM_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.3,
      });

      const choice = firstResponse.choices[0];
      if (!choice) throw new Error("LLM returned no choices");

      const assistantMessage = choice.message;
      assistantContent = assistantMessage.content ?? "";
      assistantToolCalls = assistantMessage.tool_calls
        ?.filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall => tc.type === "function")
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

      if (assistantToolCalls && assistantToolCalls.length > 0) {
        await this.persistMessages(conversationId, [
          {
            role: ASSISTANT_ROLE,
            content: assistantContent,
            toolCalls: assistantToolCalls,
          },
        ]);

        const toolResults = await this.executeToolCalls(assistantToolCalls, userId);
        await this.persistToolResults(conversationId, toolResults);

        const finalMessages = await this.buildLLMMessages(userId, conversationId, userEmail);

        const finalResponse = await this.openai.chat.completions.create({
          model: env.GLM_MODEL,
          messages: finalMessages,
          temperature: 0.3,
        });

        const finalChoice = finalResponse.choices[0];
        if (!finalChoice) throw new Error("LLM returned no choices in final response");

        assistantContent = finalChoice.message.content ?? "";
        assistantToolCalls = undefined;
      }

      await this.persistMessages(conversationId, [
        { role: ASSISTANT_ROLE, content: assistantContent },
      ]);

      logger.info("Chat assistant response generated", {
        userId,
        conversationId,
        responseLength: assistantContent.length,
      });

      return {
        conversationId,
        role: ASSISTANT_ROLE,
        content: assistantContent,
        toolCalls: assistantToolCalls,
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
   * Generate a short title for a new conversation based on the first user message.
   */
  private async generateConversationTitle(message: string): Promise<string> {
    const trimmed = message.trim();
    if (!trimmed) return "New chat";
    const firstLine = trimmed.split("\n")[0] ?? "";
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  }
}

export default ChatService;
