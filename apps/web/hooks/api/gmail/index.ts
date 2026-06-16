import { trpc } from "~/trpc/client";

export const useGmailThreads = (input: {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}) => {
  return trpc.gmail.listThreads.useQuery(input, {
    enabled: true,
  });
};

export const useGmailThreadsFromDb = (input: {
  limit?: number;
  offset?: number;
}) => {
  return trpc.gmail.listThreadsFromDb.useQuery(input, {
    enabled: true,
  });
};

export const useGmailThread = (input: { id: string; format?: "minimal" | "full" | "metadata" }) => {
  return trpc.gmail.getThread.useQuery(
    { ...input, format: input.format ?? "full" },
    {
      enabled: !!input.id,
    },
  );
};

export const useSearchMessages = (input: {
  q?: string;
  labelIds?: string[];
  from?: string;
  to?: string;
  subject?: string;
  limit?: number;
  offset?: number;
}) => {
  return trpc.gmail.searchMessages.useQuery(input, {
    enabled: true,
  });
};

export const useSendEmail = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.sendMessage.useMutation({
    onSuccess: () => {
      utils.gmail.listThreads.invalidate();
      utils.gmail.listDrafts.invalidate();
    },
  });
};

export const useGmailDrafts = (input: { maxResults?: number; pageToken?: string; q?: string }) => {
  return trpc.gmail.listDrafts.useQuery(input, {
    enabled: true,
  });
};

export const useCreateDraft = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.createDraft.useMutation({
    onSuccess: () => {
      utils.gmail.listDrafts.invalidate();
    },
  });
};

export const useUpdateDraft = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.updateDraft.useMutation({
    onSuccess: () => {
      utils.gmail.listDrafts.invalidate();
    },
  });
};

export const useDeleteDraft = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.deleteDraft.useMutation({
    onSuccess: () => {
      utils.gmail.listDrafts.invalidate();
    },
  });
};

export const useGmailLabels = () => {
  return trpc.gmail.listLabels.useQuery();
};

export const useCreateLabel = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.createLabel.useMutation({
    onSuccess: () => {
      utils.gmail.listLabels.invalidate();
    },
  });
};

export const useDeleteLabel = () => {
  const utils = trpc.useUtils();
  return trpc.gmail.deleteLabel.useMutation({
    onSuccess: () => {
      utils.gmail.listLabels.invalidate();
    },
  });
};
