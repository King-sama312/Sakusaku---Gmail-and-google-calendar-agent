"use client";

import { useState } from "react";
import Link from "next/link";
import { useGmailThreads, useGmailLabels } from "~/hooks/api/gmail";
import { env } from "~/env.js";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { MailLabels } from "~/components/mail-labels";

export default function MailInboxPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [selectedLabelId, setSelectedLabelId] = useState<string | undefined>(undefined);

  const {
    data: threadsData,
    isLoading,
    isError,
    error,
  } = useGmailThreads({
    q: debouncedQuery || undefined,
    labelIds: selectedLabelId ? [selectedLabelId] : undefined,
    pageToken,
    maxResults: 20,
  });

  const threads = threadsData?.threads ?? [];
  const hasNextPage = !!threadsData?.nextPageToken;

  function handleSearch() {
    setDebouncedQuery(searchQuery);
    setPageToken(undefined);
  }

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r p-3 hidden lg:block">
        <MailLabels selectedLabelId={selectedLabelId} onSelectLabel={setSelectedLabelId} />
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2 border-b p-3">
          <Input
            placeholder="Search mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1"
          />
          <Button variant="secondary" size="sm" onClick={handleSearch}>
            Search
          </Button>
          <Link href="/mail?compose=true">
            <Button size="sm">Compose</Button>
          </Link>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-sm">
              <p className="text-destructive font-medium">Failed to load conversations</p>
              <p className="text-muted-foreground text-xs max-w-md text-center">
                {error?.message ?? "An unknown error occurred"}
              </p>
              {error?.message?.toLowerCase().includes("account not found") && (
                <a
                  href={`${new URL(env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").origin}/auth/gmail`}
                >
                  <Button variant="default" size="sm">
                    Connect Gmail
                  </Button>
                </a>
              )}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No conversations found
            </div>
          ) : (
            <div className="divide-y">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/mail/${thread.id}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">
                      {thread.snippet?.slice(0, 60) || "(no subject)"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {thread.snippet || ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between border-t p-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!pageToken}
            onClick={() => setPageToken(undefined)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {threads.length > 0 ? `${threads.length} conversations` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => threadsData?.nextPageToken && setPageToken(threadsData.nextPageToken)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
