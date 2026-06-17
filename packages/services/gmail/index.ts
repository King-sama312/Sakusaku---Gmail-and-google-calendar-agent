import { corsair } from "../corsair";
import { db, eq, and, sql, desc, arrayOverlaps, type SQL } from "@repo/database";
import { gmailThreadMetadataTable } from "@repo/database/schema";
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
  type GetDraftInputType,
  getDraftInput,
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

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getTextFromPayload(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
}): string | undefined {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return base64UrlDecode(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return base64UrlDecode(part.body.data);
      }
    }
  }
  return undefined;
}

function extractThreadMetadata(thread: {
  messages?: Array<{
    labelIds?: string[];
    payload?: {
      headers?: Array<{ name?: string; value?: string }>;
    };
  }>;
}): { subject?: string; from?: string; labelIds?: string[]; date?: Date } {
  const firstMessage = thread.messages?.[0];
  const headers = firstMessage?.payload?.headers;
  const dateHeader = extractHeader(headers, "Date");
  const parsedDate = dateHeader ? new Date(dateHeader) : undefined;
  return {
    subject: extractHeader(headers, "Subject"),
    from: extractHeader(headers, "From"),
    labelIds: firstMessage?.labelIds,
    date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined,
  };
}

function encodeMimeHeader(value: string): string {
  // If the value is pure ASCII, return as-is.
  if (/^[\x00-\x7F]*$/.test(value)) return value;

  // RFC 2047 encode non-ASCII text.
  const encoded = Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `=?UTF-8?B?${encoded}?=`;
}

function buildMimeMessage(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const headers: string[] = [
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (params.cc) headers.push(`Cc: ${params.cc}`);
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`);
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);
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
    threads: Array<{ id?: string; snippet?: string; historyId?: string; labelIds?: string[] }>,
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
    const enriched = await this.enrichThreadsWithMetadata(userId, threads);
    return {
      ...response,
      threads: enriched.map((t) => ({
        ...t,
        date: t.date ? t.date.toISOString() : undefined,
      })),
    };
  }

  private buildMetadataFilters(userId: string, labelIds?: string[]) {
    const filters: SQL[] = [eq(gmailThreadMetadataTable.userId, userId)];
    if (labelIds && labelIds.length > 0) {
      filters.push(arrayOverlaps(gmailThreadMetadataTable.labelIds, labelIds));
    }
    return filters;
  }

  private async upsertThreadMetadata(
    userId: string,
    threads: Array<{
      id?: string;
      snippet?: string;
      historyId?: string;
      subject?: string;
      from?: string;
      labelIds?: string[];
      date?: Date;
    }>,
  ) {
    if (threads.length === 0) return;

    const values = threads
      .filter((t) => t.id)
      .map((t) => ({
        userId,
        threadId: t.id!,
        subject: t.subject ?? null,
        fromAddress: t.from ?? null,
        snippet: t.snippet ?? null,
        historyId: t.historyId ?? null,
        labelIds: t.labelIds ?? null,
        date: t.date ?? null,
        updatedAt: new Date(),
      }));

    if (values.length === 0) return;

    await db
      .insert(gmailThreadMetadataTable)
      .values(values)
      .onConflictDoUpdate({
        target: [gmailThreadMetadataTable.userId, gmailThreadMetadataTable.threadId],
        set: {
          subject: sql`excluded.subject`,
          fromAddress: sql`excluded.from_address`,
          snippet: sql`excluded.snippet`,
          historyId: sql`excluded.history_id`,
          labelIds: sql`excluded.label_ids`,
          date: sql`excluded.date`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async syncThreadMetadata(userId: string, params: ListThreadsInputType = {}) {
    const {
      q,
      maxResults = 100,
      pageToken,
      labelIds,
      includeSpamTrash,
    } = await listThreadsInput.parseAsync(params);

    const response = await this.tenant(userId).gmail.api.threads.list({
      q,
      maxResults,
      pageToken,
      labelIds,
      includeSpamTrash,
    });

    const threads = response.threads ?? [];
    const enriched = await this.enrichThreadsWithMetadata(userId, threads);

    await this.upsertThreadMetadata(
      userId,
      enriched.map((t) => ({
        id: t.id,
        snippet: t.snippet,
        historyId: t.historyId,
        subject: t.subject,
        from: t.from,
        labelIds: t.labelIds,
        date: t.date,
      })),
    );

    return {
      ...response,
      threads: enriched.map((t) => ({
        ...t,
        date: t.date ? t.date.toISOString() : undefined,
      })),
    };
  }

  async listThreadsFromDb(
    userId: string,
    params: { limit?: number; offset?: number; labelIds?: string[] } = {},
  ) {
    const { limit = 20, offset = 0, labelIds } = params;
    const filters = this.buildMetadataFilters(userId, labelIds);

    const cached = await db
      .select()
      .from(gmailThreadMetadataTable)
      .where(and(...filters))
      .orderBy(sql`${gmailThreadMetadataTable.date} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset);

    return {
      threads: cached.map((t) => ({
        id: t.threadId,
        snippet: t.snippet ?? undefined,
        historyId: t.historyId ?? undefined,
        subject: t.subject ?? undefined,
        from: t.fromAddress ?? undefined,
        labelIds: t.labelIds ?? undefined,
        date: t.date ? t.date.toISOString() : undefined,
      })),
      resultSizeEstimate: cached.length,
    };
  }

  private async updateCachedThreadLabels(
    userId: string,
    threadId: string,
    add: string[],
    remove: string[],
  ) {
    const row = await db
      .select({ labelIds: gmailThreadMetadataTable.labelIds })
      .from(gmailThreadMetadataTable)
      .where(
        and(
          eq(gmailThreadMetadataTable.userId, userId),
          eq(gmailThreadMetadataTable.threadId, threadId),
        ),
      )
      .limit(1);

    const [first] = row;
    if (!first) return;

    const current = first.labelIds ?? [];
    const next = [
      ...current.filter((id) => !remove.includes(id)),
      ...add.filter((id) => !current.includes(id)),
    ];

    await db
      .update(gmailThreadMetadataTable)
      .set({ labelIds: next })
      .where(
        and(
          eq(gmailThreadMetadataTable.userId, userId),
          eq(gmailThreadMetadataTable.threadId, threadId),
        ),
      );
  }

  async starThread(userId: string, threadId: string) {
    await this.tenant(userId).gmail.api.threads.modify({
      id: threadId,
      addLabelIds: ["STARRED"],
    });
    await this.updateCachedThreadLabels(userId, threadId, ["STARRED"], []);
  }

  async unstarThread(userId: string, threadId: string) {
    await this.tenant(userId).gmail.api.threads.modify({
      id: threadId,
      removeLabelIds: ["STARRED"],
    });
    await this.updateCachedThreadLabels(userId, threadId, [], ["STARRED"]);
  }

  async trashThread(userId: string, threadId: string) {
    await this.tenant(userId).gmail.api.threads.modify({
      id: threadId,
      addLabelIds: ["TRASH"],
      removeLabelIds: ["INBOX"],
    });
    await this.updateCachedThreadLabels(userId, threadId, ["TRASH"], ["INBOX"]);
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
    const { to, subject, body, cc, bcc, threadId } = await sendMessageInput.parseAsync(params);

    let inReplyTo: string | undefined;
    let references: string | undefined;

    if (threadId) {
      try {
        const thread = await this.tenant(userId).gmail.api.threads.get({
          id: threadId,
          format: "metadata",
        });
        const lastMessage = thread.messages?.[thread.messages.length - 1];
        const messageId = extractHeader(lastMessage?.payload?.headers, "Message-ID");
        if (messageId) {
          inReplyTo = messageId;
          references = messageId;
        }
      } catch {
        // Best-effort; Gmail can still thread by threadId.
      }
    }

    const raw = buildMimeMessage({ to, subject, body, cc, bcc, inReplyTo, references });
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

  async getDraft(userId: string, params: GetDraftInputType) {
    const { id } = await getDraftInput.parseAsync(params);
    return this.tenant(userId).gmail.api.drafts.get({ id });
  }

  async createDraft(userId: string, params: CreateDraftInputType) {
    const { to, subject, body, cc, bcc, threadId } = await createDraftInput.parseAsync(params);
    const raw = buildMimeMessage({ to, subject, body, cc, bcc });
    return this.tenant(userId).gmail.api.drafts.create({
      draft: { message: { raw, threadId } },
    });
  }

  async updateDraft(userId: string, params: UpdateDraftInputType) {
    const { id, to, subject, body, cc, bcc } = await updateDraftInput.parseAsync(params);

    // Fetch the existing draft so partial updates preserve untouched fields.
    const existing = await this.tenant(userId).gmail.api.drafts.get({ id });
    const existingPayload = existing.message?.payload as
      | {
          mimeType?: string;
          headers?: Array<{ name?: string; value?: string }>;
          body?: { data?: string };
          parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
        }
      | undefined;

    const headers = existingPayload?.headers;
    const existingBody = existingPayload ? getTextFromPayload(existingPayload) : undefined;

    const finalTo = to ?? extractHeader(headers, "To");
    const finalSubject = subject ?? extractHeader(headers, "Subject");
    const finalBody = body ?? existingBody ?? "";
    const finalCc = cc ?? extractHeader(headers, "Cc");
    const finalBcc = bcc ?? extractHeader(headers, "Bcc");

    if (!finalTo || !finalSubject) {
      throw new Error("Draft is missing required recipient or subject");
    }

    const raw = buildMimeMessage({
      to: finalTo,
      subject: finalSubject,
      body: finalBody,
      cc: finalCc,
      bcc: finalBcc,
    });

    return this.tenant(userId).gmail.api.drafts.update({
      id,
      draft: { message: { raw } },
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
