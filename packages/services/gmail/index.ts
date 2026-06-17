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

function extractHeader(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | undefined {
  if (!Array.isArray(headers)) return undefined;
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
}

function extractThreadMetadata(thread: {
  messages?: Array<{
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
    };
  }>;
}): { subject?: string; from?: string } {
  const firstMessage = thread.messages?.[0];
  const headers = firstMessage?.payload?.headers;
  return {
    subject: extractHeader(headers, "Subject"),
    from: extractHeader(headers, "From"),
  };
}

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

  private async enrichThreadsWithMetadata(
    userId: string,
    threads: Array<{ id?: string; snippet?: string; historyId?: string }>,
  ) {
    const tenant = this.tenant(userId);
    const enriched = await Promise.all(
      threads.map(async (thread) => {
        if (!thread.id) return { ...thread, subject: undefined, from: undefined };
        try {
          const detail = await tenant.gmail.api.threads.get({
            id: thread.id,
            format: "metadata",
          });
          const metadata = extractThreadMetadata(detail);
          return { ...thread, ...metadata };
        } catch {
          return { ...thread, subject: undefined, from: undefined };
        }
      }),
    );
    return enriched;
  }

  async listThreads(userId: string, params: ListThreadsInputType) {
    const { q, maxResults, pageToken, labelIds, includeSpamTrash } =
      await listThreadsInput.parseAsync(params);
    const response = await this.tenant(userId).gmail.api.threads.list({
      q,
      maxResults,
      pageToken,
      labelIds,
      includeSpamTrash,
    });

    const threads = response.threads ?? [];
    return {
      ...response,
      threads: await this.enrichThreadsWithMetadata(userId, threads),
    };
  }

  async listThreadsFromDb(userId: string, params: { limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0 } = params;
    const threads = await this.tenant(userId).gmail.db.threads.list({
      limit,
      offset,
    });

    const summaries = threads.map((t) => ({
      id: t.data.id,
      snippet: t.data.snippet,
      historyId: t.data.historyId,
    }));

    return {
      threads: await this.enrichThreadsWithMetadata(userId, summaries),
      resultSizeEstimate: threads.length,
    };
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
