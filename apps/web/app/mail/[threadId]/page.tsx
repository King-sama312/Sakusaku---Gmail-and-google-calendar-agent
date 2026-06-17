"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGmailThread } from "~/hooks/api/gmail";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ComposeEmail } from "~/components/compose-email";
import { EmailViewer } from "~/components/email-viewer";
import { parseMessage, getEmailBodyText } from "~/lib/email";

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>();
  const router = useRouter();
  const [showReply, setShowReply] = useState(false);

  const {
    data: thread,
    isLoading,
    isError,
    error,
  } = useGmailThread({
    id: params.threadId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-sm">
        <p className="text-destructive font-medium">Failed to load thread</p>
        <p className="text-muted-foreground text-xs">
          {error?.message ?? "An unknown error occurred"}
        </p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Thread not found
      </div>
    );
  }

  const messages = thread.messages ?? [];

  // Use the most recent message as the basis for the reply.
  const lastMessage = messages[messages.length - 1];
  const lastParsed = lastMessage ? parseMessage(lastMessage as Record<string, unknown>) : null;
  const threadSubject = lastParsed?.headers.subject || thread.snippet?.slice(0, 60) || "";
  const replyTo = lastParsed?.headers.from || "";
  const replyToEmail = replyTo.match(/<([^>]+)>/)?.[1] ?? replyTo;
  const replySubject =
    threadSubject && !threadSubject.toLowerCase().startsWith("re:")
      ? `Re: ${threadSubject}`
      : threadSubject;

  const quotedBody = lastParsed
    ? `\n\nOn ${lastParsed.headers.date ?? ""}, ${replyTo} wrote:\n${getEmailBodyText(lastParsed)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}`
    : "";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReply(!showReply)}>
          Reply
        </Button>
      </div>

      <div className="flex-1 overflow-auto min-h-0 space-y-3 p-6">
        {messages.map((message, idx) => (
          <EmailViewer key={message.id ?? idx} message={message as Record<string, unknown>} />
        ))}
      </div>

      {showReply && (
        <div className="border-t p-4">
          <ComposeEmail
            initialTo={replyToEmail}
            initialSubject={replySubject}
            initialBody={quotedBody}
            threadId={params.threadId}
            onSuccess={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}
    </div>
  );
}
