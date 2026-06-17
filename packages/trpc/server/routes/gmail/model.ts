import { z } from "zod";

export const listThreadsInputModel = z.object({
  q: z.string().optional().describe("Gmail search query"),
  maxResults: z.number().int().positive().max(500).optional().describe("Max results"),
  pageToken: z.string().optional().describe("Page token for pagination"),
  labelIds: z.array(z.string()).optional().describe("Filter by label IDs"),
  includeSpamTrash: z.boolean().optional().describe("Include spam and trash"),
});

export const listThreadsOutputModel = z.object({
  threads: z
    .array(
      z.object({
        id: z.string().optional(),
        snippet: z.string().optional(),
        historyId: z.string().optional(),
        subject: z.string().optional(),
        from: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        date: z.string().datetime().optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export const getThreadInputModel = z.object({
  id: z.string().describe("Thread ID"),
  format: z.enum(["minimal", "full", "metadata"]).optional().describe("Thread format"),
});

export const getThreadOutputModel = z.object({
  id: z.string().optional(),
  snippet: z.string().optional(),
  historyId: z.string().optional(),
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        threadId: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        snippet: z.string().optional(),
        internalDate: z.string().optional(),
        payload: z.any().optional(),
      }),
    )
    .optional(),
});

export const listThreadsFromDbInputModel = z.object({
  limit: z.number().int().positive().max(500).optional().describe("Max results"),
  offset: z.number().int().min(0).optional().describe("Offset for pagination"),
  labelIds: z.array(z.string()).optional().describe("Filter by cached label IDs"),
});

export const listThreadsFromDbOutputModel = z.object({
  threads: z
    .array(
      z.object({
        id: z.string().optional(),
        snippet: z.string().optional(),
        historyId: z.string().optional(),
        subject: z.string().optional(),
        from: z.string().optional(),
        labelIds: z.array(z.string()).optional(),
        date: z.string().datetime().optional(),
      }),
    )
    .optional(),
  resultSizeEstimate: z.number().optional(),
});

export const searchMessagesInputModel = z.object({
  q: z.string().optional().describe("Gmail search query"),
  labelIds: z.array(z.string()).optional().describe("Filter by label IDs"),
  from: z.string().optional().describe("Sender email"),
  to: z.string().optional().describe("Recipient email"),
  subject: z.string().optional().describe("Subject"),
  limit: z.number().int().positive().max(500).optional().describe("Max results"),
  offset: z.number().int().min(0).optional().describe("Offset"),
});

export const searchMessagesOutputModel = z.array(
  z.object({
    id: z.string(),
    entityId: z.string().optional(),
    entityType: z.string().optional(),
    data: z.any().optional(),
  }),
);

export const sendMessageInputModel = z.object({
  to: z.string().describe("Recipient email"),
  subject: z.string().describe("Subject"),
  body: z.string().describe("Plain text body"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
  threadId: z.string().optional().describe("Thread to reply to"),
});

export const sendMessageOutputModel = z.object({
  id: z.string().optional(),
  threadId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
});

export const listDraftsInputModel = z.object({
  maxResults: z.number().int().positive().max(500).optional().describe("Max results"),
  pageToken: z.string().optional().describe("Page token"),
  q: z.string().optional().describe("Search query"),
});

export const getDraftInputModel = z.object({
  id: z.string().describe("Draft ID"),
});

export const getDraftOutputModel = z.object({
  id: z.string().optional(),
  message: z
    .object({
      id: z.string().optional(),
      threadId: z.string().optional(),
      payload: z.any().optional(),
    })
    .optional(),
});

export const listDraftsOutputModel = z.object({
  drafts: z
    .array(
      z.object({
        id: z.string().optional(),
        message: z
          .object({
            id: z.string().optional(),
            threadId: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export const createDraftInputModel = z.object({
  to: z.string().describe("Recipient email"),
  subject: z.string().describe("Subject"),
  body: z.string().describe("Plain text body"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
  threadId: z.string().optional().describe("Thread to reply to"),
});

export const createDraftOutputModel = z.object({
  id: z.string().optional(),
  message: z
    .object({
      id: z.string().optional(),
      threadId: z.string().optional(),
    })
    .optional(),
});

export const updateDraftInputModel = z.object({
  id: z.string().describe("Draft ID"),
  to: z.string().optional().describe("Recipient email"),
  subject: z.string().optional().describe("Subject"),
  body: z.string().optional().describe("Plain text body"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
});

export const updateDraftOutputModel = createDraftOutputModel;

export const deleteDraftInputModel = z.object({
  id: z.string().describe("Draft ID"),
});

export const deleteDraftOutputModel = z.object({
  success: z.boolean(),
});

export const listLabelsInputModel = z.undefined();

export const listLabelsOutputModel = z.object({
  labels: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        type: z.enum(["system", "user"]).optional(),
        messagesTotal: z.number().optional(),
        messagesUnread: z.number().optional(),
      }),
    )
    .optional(),
});

export const createLabelInputModel = z.object({
  name: z.string().min(1).describe("Label name"),
  labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
  messageListVisibility: z.enum(["show", "hide"]).optional(),
});

export const createLabelOutputModel = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.enum(["system", "user"]).optional(),
});

export const deleteLabelInputModel = z.object({
  id: z.string().describe("Label ID"),
});

export const deleteLabelOutputModel = z.object({
  success: z.boolean(),
});
