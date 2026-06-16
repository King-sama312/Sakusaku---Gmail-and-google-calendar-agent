import { trpc } from "~/trpc/client";

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  role: ChatMessageRole;
  content?: string;
  toolCallId?: string;
  toolName?: string;
}

export const useSendMessage = () => {
  const utils = trpc.useUtils();
  return trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      utils.chat.getConversation.invalidate({ id: data.conversationId });
      utils.chat.listConversations.invalidate();
    },
  });
};

export const useConversations = () => {
  return trpc.chat.listConversations.useQuery();
};

export const useConversation = (id: string | undefined) => {
  return trpc.chat.getConversation.useQuery(
    { id: id ?? "" },
    {
      enabled: !!id,
    },
  );
};

export const useDeleteConversation = () => {
  const utils = trpc.useUtils();
  return trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      utils.chat.listConversations.invalidate();
    },
  });
};
