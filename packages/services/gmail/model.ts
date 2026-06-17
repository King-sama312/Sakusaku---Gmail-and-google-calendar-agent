import { z } from "zod";

export const listThreadsInput = z.object({
  q: z.string().optional().describe("Gmail search query"),
  maxResults: z.number().int().positive().max(500).optional().describe("Max results to return"),
  pageToken: z.string().optional().describe("Page token for pagination"),
  labelIds: z.array(z.string()).optional().describe("Only return threads with these labels"),
  includeSpamTrash: z.boolean().optional().describe("Include spam and trash"),
});
export type ListThreadsInputType = z.infer<typeof listThreadsInput>;

export const getThreadInput = z.object({
  id: z.string().describe("Thread ID"),
  format: z.enum(["minimal", "full", "metadata"]).optional().describe("Thread format"),
});
export type GetThreadInputType = z.infer<typeof getThreadInput>;

export const searchMessagesInput = z.object({
  q: z.string().optional().describe("Gmail search query"),
  labelIds: z.array(z.string()).optional().describe("Filter by label IDs"),
  from: z.string().optional().describe("Sender email to filter by"),
  to: z.string().optional().describe("Recipient email to filter by"),
  subject: z.string().optional().describe("Subject to filter by"),
  limit: z.number().int().positive().max(500).optional().describe("Max results"),
  offset: z.number().int().min(0).optional().describe("Offset for pagination"),
});
export type SearchMessagesInputType = z.infer<typeof searchMessagesInput>;

export const sendMessageInput = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body (plain text)"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
  threadId: z.string().optional().describe("Thread ID to reply to"),
});
export type SendMessageInputType = z.infer<typeof sendMessageInput>;

export const listDraftsInput = z.object({
  maxResults: z.number().int().positive().max(500).optional().describe("Max drafts to return"),
  pageToken: z.string().optional().describe("Page token for pagination"),
  q: z.string().optional().describe("Gmail search query"),
});
export type ListDraftsInputType = z.infer<typeof listDraftsInput>;

export const createDraftInput = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body (plain text)"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
  threadId: z.string().optional().describe("Thread ID to reply to"),
});
export type CreateDraftInputType = z.infer<typeof createDraftInput>;

export const updateDraftInput = z.object({
  id: z.string().describe("Draft ID to update"),
  to: z.string().optional().describe("Recipient email address"),
  subject: z.string().optional().describe("Email subject"),
  body: z.string().optional().describe("Email body (plain text)"),
  cc: z.string().optional().describe("CC recipient"),
  bcc: z.string().optional().describe("BCC recipient"),
});
export type UpdateDraftInputType = z.infer<typeof updateDraftInput>;

export const deleteDraftInput = z.object({
  id: z.string().describe("Draft ID to delete"),
});
export type DeleteDraftInputType = z.infer<typeof deleteDraftInput>;

export const createLabelInput = z.object({
  name: z.string().min(1).describe("Label name"),
  labelListVisibility: z.enum(["labelShow", "labelShowIfUnread", "labelHide"]).optional(),
  messageListVisibility: z.enum(["show", "hide"]).optional(),
});
export type CreateLabelInputType = z.infer<typeof createLabelInput>;

export const deleteLabelInput = z.object({
  id: z.string().describe("Label ID to delete"),
});
export type DeleteLabelInputType = z.infer<typeof deleteLabelInput>;
