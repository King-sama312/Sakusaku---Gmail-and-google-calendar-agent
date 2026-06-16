import { z } from "../../schema";
import { chatService } from "../../services";
import { authenticatedProcedure, router } from "../../trpc";
import { generatePath } from "../../utils/path-generator";
import {
  sendMessageInputModel,
  sendMessageOutputModel,
  listConversationsOutputModel,
  conversationWithMessagesOutputModel,
  deleteConversationOutputModel,
} from "./model";

const TAGS = ["AI Chat"];
const getPath = generatePath("/chat");

export const chatRouter = router({
  sendMessage: authenticatedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/messages"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(sendMessageInputModel)
    .output(sendMessageOutputModel)
    .mutation(async ({ input, ctx }) => {
      return await chatService.sendMessage(ctx.user.id, input);
    }),

  listConversations: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/conversations"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.undefined())
    .output(listConversationsOutputModel)
    .query(async ({ ctx }) => {
      return await chatService.listConversations(ctx.user.id);
    }),

  getConversation: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/conversations/{id}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(conversationWithMessagesOutputModel)
    .query(async ({ input, ctx }) => {
      const data = await chatService.getConversation(ctx.user.id, input.id);
      return {
        conversation: data.conversation,
        messages: data.messages.map((m) => ({
          ...m,
          role: m.role as "system" | "user" | "assistant" | "tool",
        })),
      };
    }),

  deleteConversation: authenticatedProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: getPath("/conversations/{id}"),
        tags: TAGS,
        protect: true,
      },
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(deleteConversationOutputModel)
    .mutation(async ({ input, ctx }) => {
      await chatService.deleteConversation(ctx.user.id, input.id);
      return { success: true };
    }),
});
