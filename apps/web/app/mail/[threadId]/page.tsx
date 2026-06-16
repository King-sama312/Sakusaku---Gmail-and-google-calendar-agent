"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGmailThread } from "~/hooks/api/gmail";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { ComposeEmail } from "~/components/compose-email";

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b p-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReply(!showReply)}>
          Reply
        </Button>
      </div>

      <div className="flex-1 overflow-auto space-y-3 p-6">
        {messages.map((message, idx) => (
          <Card key={message.id ?? idx}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {message.snippet?.slice(0, 80) || "Unknown"}
                </span>
                {message.internalDate && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(Number(message.internalDate)).toLocaleString()}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {message.snippet || "(no content)"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showReply && (
        <div className="border-t p-4">
          <ComposeEmail
            initialTo=""
            initialSubject={thread.snippet ? `Re: ${thread.snippet.slice(0, 60)}` : ""}
            threadId={params.threadId}
            onSuccess={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        </div>
      )}
    </div>
  );
}
