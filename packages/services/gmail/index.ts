import { corsair } from "../corsair";
import {
  type ListThreadsInputType,
  listThreadsInput,
  type GetThreadInputType,
  getThreadInput,
  type SearchMessagesInputType,
  searchMessagesInput,
  type SendMessageInputType,
  sendMessageInput,
  type ListDraftsInputType,
  listDraftsInput,
  type CreateDraftInputType,
  createDraftInput,
  type UpdateDraftInputType,
  updateDraftInput,
  type DeleteDraftInputType,
  deleteDraftInput,
  type CreateLabelInputType,
  createLabelInput,
  type DeleteLabelInputType,
  deleteLabelInput,
} from "./model";

function buildMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): string {
  const headers: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (params.cc) headers.push(`Cc: ${params.cc}`);
  headers.push("", params.body);
  const raw = headers.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

class GmailService {
  private tenant(userId: string) {
    return corsair.withTenant(userId);
  }

  async listThreads(userId: string, params: ListThreadsInputType) {
    const { q, maxResults, pageToken, labelIds, includeSpamTrash } =
      await listThreadsInput.parseAsync(params);
    return this.tenant(userId).gmail.api.threads.list({
      q,
      maxResults,
      pageToken,
      labelIds,
      includeSpamTrash,
    });
  }

  async getThread(userId: string, params: GetThreadInputType) {
    const { id, format } = await getThreadInput.parseAsync(params);
    return this.tenant(userId).gmail.api.threads.get({ id, format });
  }

  async searchMessages(userId: string, params: SearchMessagesInputType) {
    const { q, labelIds, from, to, subject, limit, offset } =
      await searchMessagesInput.parseAsync(params);
    const filters: Record<string, unknown> = {};
    if (q) filters.q = q;
    if (labelIds) filters.labelIds = labelIds;
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (subject) filters.subject = subject;
    return this.tenant(userId).gmail.db.messages.search({
      data: filters,
      limit,
      offset,
    });
  }

  async sendMessage(userId: string, params: SendMessageInputType) {
    const { to, subject, body, cc, threadId } = await sendMessageInput.parseAsync(params);
    const raw = buildMimeMessage({ to, subject, body, cc });
    return this.tenant(userId).gmail.api.messages.send({ raw, threadId });
  }

  async listDrafts(userId: string, params: ListDraftsInputType) {
    const { maxResults, pageToken, q } = await listDraftsInput.parseAsync(params);
    return this.tenant(userId).gmail.api.drafts.list({
      maxResults,
      pageToken,
      q,
    });
  }

  async createDraft(userId: string, params: CreateDraftInputType) {
    const { to, subject, body, cc, threadId } = await createDraftInput.parseAsync(params);
    const raw = buildMimeMessage({ to, subject, body, cc });
    return this.tenant(userId).gmail.api.drafts.create({
      draft: { message: { raw, threadId } },
    });
  }

  async updateDraft(userId: string, params: UpdateDraftInputType) {
    const { id, to, subject, body, cc } = await updateDraftInput.parseAsync(params);
    const raw = to && subject && body ? buildMimeMessage({ to, subject, body, cc }) : undefined;
    return this.tenant(userId).gmail.api.drafts.update({
      id,
      draft: raw ? { message: { raw } } : undefined,
    });
  }

  async deleteDraft(userId: string, params: DeleteDraftInputType) {
    const { id } = await deleteDraftInput.parseAsync(params);
    return this.tenant(userId).gmail.api.drafts.delete({ id });
  }

  async listLabels(userId: string) {
    return this.tenant(userId).gmail.api.labels.list({});
  }

  async createLabel(userId: string, params: CreateLabelInputType) {
    const { name, labelListVisibility, messageListVisibility } =
      await createLabelInput.parseAsync(params);
    return this.tenant(userId).gmail.api.labels.create({
      label: { name, labelListVisibility, messageListVisibility },
    });
  }

  async deleteLabel(userId: string, params: DeleteLabelInputType) {
    const { id } = await deleteLabelInput.parseAsync(params);
    return this.tenant(userId).gmail.api.labels.delete({ id });
  }
}

export default GmailService;
