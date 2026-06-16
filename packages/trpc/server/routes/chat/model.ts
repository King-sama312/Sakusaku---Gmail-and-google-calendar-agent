import { z } from "zod";

const chatRoleModel = z.enum(["user", "assistant", "system", "tool"]);

export const chatMessageModel = z.object({
  role: chatRoleModel,
  content: z.string().optional(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
});

export const sendMessageInputModel = z.object({
  conversationId: z.string().uuid().optional().describe("Existing conversation ID"),
  message: z.string().min(1).max(4000).describe("User message"),
  history: z.array(chatMessageModel).max(200).optional().default([]),
});

export const sendMessageOutputModel = z.object({
  conversationId: z.string().uuid(),
  role: z.literal("assistant"),
  content: z.string(),
  toolCalls: z.array(z.any()).optional(),
});

export const conversationOutputModel = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  model: z.string(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export const persistedMessageOutputModel = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: chatRoleModel,
  content: z.string().nullable(),
  toolCallId: z.string().nullable(),
  toolName: z.string().nullable(),
  createdAt: z.date(),
});

export const listConversationsOutputModel = z.array(conversationOutputModel);

export const conversationWithMessagesOutputModel = z.object({
  conversation: conversationOutputModel,
  messages: z.array(persistedMessageOutputModel),
});

export const deleteConversationOutputModel = z.object({
  success: z.boolean(),
});
