"use client";

import { useState } from "react";
import { useGmailDrafts, useGmailDraft, useDeleteDraft } from "~/hooks/api/gmail";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ComposeEmail } from "~/components/compose-email";
import { parseMessage } from "~/lib/email";

export default function DraftsPage() {
  const [editDraftId, setEditDraftId] = useState<string | null>(null);

  const { data: draftsData, isLoading } = useGmailDrafts({});
  const { data: draftDetail, isLoading: isLoadingDraftDetail } = useGmailDraft(editDraftId);
  const { mutateAsync: deleteDraft } = useDeleteDraft();

  const drafts = draftsData?.drafts ?? [];

  async function handleDelete(id: string) {
    await deleteDraft({ id });
  }

  const draftPayload = draftDetail?.message?.payload as Record<string, unknown> | undefined;
  const parsedDraft = draftPayload
    ? parseMessage(draftDetail?.message as Record<string, unknown>)
    : null;
  const draftTo = parsedDraft?.headers.to ?? "";
  const draftCc = parsedDraft?.headers.cc ?? "";
  const draftBcc = parsedDraft?.headers.bcc ?? "";
  const draftSubject = parsedDraft?.headers.subject ?? "";
  const draftBody = parsedDraft?.content.textPlain ?? "";

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-3">
        <h1 className="text-lg font-semibold">Drafts</h1>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No drafts
          </div>
        ) : (
          <div className="divide-y">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <button
                  className="flex-1 text-left"
                  onClick={() => setEditDraftId(draft.id ?? null)}
                >
                  <p className="text-sm font-medium truncate">
                    {draft.message?.id
                      ? `Draft #${draft.message.threadId?.slice(0, 8) ?? ""}`
                      : "New draft"}
                  </p>
                  <p className="text-xs text-muted-foreground">{draft.id}</p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => draft.id && handleDelete(draft.id)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Dialog open={!!editDraftId} onOpenChange={(open) => !open && setEditDraftId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
          </DialogHeader>
          {isLoadingDraftDetail ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <ComposeEmail
              initialTo={draftTo}
              initialCc={draftCc}
              initialBcc={draftBcc}
              initialSubject={draftSubject}
              initialBody={draftBody}
              draftId={editDraftId ?? undefined}
              threadId={draftDetail?.message?.threadId}
              onSuccess={() => setEditDraftId(null)}
              onCancel={() => setEditDraftId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
