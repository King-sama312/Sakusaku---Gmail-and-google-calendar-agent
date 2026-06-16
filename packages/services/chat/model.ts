import { z } from "zod";

/**
 * Supported chat message roles.
 * `tool` represents a tool result message returned to the LLM.
 */
export const chatRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type ChatRole = z.infer<typeof chatRoleSchema>;

/**
 * A single message in the chat history.
 */
export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string().optional().describe("Text content of the message"),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string().describe("JSON-encoded arguments"),
        }),
      }),
    )
    .optional()
    .describe("Tool calls emitted by the assistant"),
  toolCallId: z.string().optional().describe("ID of the tool call this message responds to"),
  toolName: z.string().optional().describe("Name of the tool that produced this result"),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * Input for sending a chat message.
 */
export const sendMessageInputSchema = z.object({
  conversationId: z.string().uuid().optional().describe("Existing conversation ID"),
  message: z.string().min(1).max(4000).describe("User message"),
  history: z.array(chatMessageSchema).max(200).optional().default([]),
});
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

/**
 * Output returned after processing a chat message.
 */
export const sendMessageOutputSchema = z.object({
  conversationId: z.string().uuid().describe("Conversation ID"),
  role: z.literal("assistant"),
  content: z.string().describe("Assistant response text"),
  toolCalls: z.array(z.any()).optional(),
});
export type SendMessageOutput = z.infer<typeof sendMessageOutputSchema>;

/**
 * Tool result produced by executing a tool.
 */
export const toolResultSchema = z.object({
  toolCallId: z.string(),
  toolName: z.string(),
  content: z.string().describe("Stringified result returned to the LLM"),
  error: z.boolean().default(false).describe("Whether the tool execution failed"),
});
export type ToolResult = z.infer<typeof toolResultSchema>;

/**
 * Tool definition exposed to the LLM.
 */
export const toolDefinitionSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.string(), z.any()).describe("JSON Schema object"),
  }),
});
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

/**
 * Shape of a conversation as returned to clients.
 */
export const conversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  model: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});
export type Conversation = z.infer<typeof conversationSchema>;

/**
 * Shape of a persisted chat message as returned to clients.
 */
export const persistedMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: chatRoleSchema,
  content: z.string().nullable(),
  toolCallId: z.string().nullable(),
  toolName: z.string().nullable(),
  createdAt: z.date(),
});
export type PersistedMessage = z.infer<typeof persistedMessageSchema>;
