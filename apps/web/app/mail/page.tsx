"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGmailThreads, useGmailThreadsFromDb } from "~/hooks/api/gmail";
import { useRequireAuth } from "~/hooks/api/auth";
import { trpc } from "~/trpc/client";
import { env } from "~/env.js";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { MailLabels } from "~/components/mail-labels";
import { CategoryTabs } from "~/components/category-tabs";

export default function MailInboxPage() {
  const { user, isLoading: isAuthLoading } = useRequireAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [selectedLabelId, setSelectedLabelId] = useState<string | undefined>(undefined);
  const [dbOffset, setDbOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use the live API for search/label filters; otherwise read the synced DB cache.
  const shouldUseApi = !!debouncedQuery || !!selectedLabelId;
  const isReady = !isAuthLoading && !!user;

  // Reset pagination when switching data sources so we don't land on a stale page.
  useEffect(() => {
    if (shouldUseApi) {
      setDbOffset(0);
    } else {
      setPageToken(undefined);
    }
  }, [shouldUseApi]);

  // Fetch from API (for search, category filter, or manual refresh)
  const {
    data: apiData,
    isLoading: isApiLoading,
    isFetching: isApiFetching,
    isError: isApiError,
    error: apiError,
    refetch: refetchApi,
  } = useGmailThreads(
    {
      q: debouncedQuery || undefined,
      labelIds: selectedLabelId ? [selectedLabelId] : undefined,
      pageToken,
      maxResults: 20,
    },
    { enabled: isReady && shouldUseApi },
  );

  // Fetch from DB (default, fast)
  const {
    data: dbData,
    isLoading: isDbLoading,
    isFetching: isDbFetching,
    isError: isDbError,
    error: dbError,
  } = useGmailThreadsFromDb(
    {
      limit: 20,
      offset: dbOffset,
    },
    { enabled: isReady && !shouldUseApi },
  );

  const utils = trpc.useUtils();

  // Determine which data source to render
  const threadsData = shouldUseApi ? apiData : dbData;
  const isLoading = shouldUseApi ? isApiLoading : isDbLoading;
  const isError = shouldUseApi ? isApiError : isDbError;
  const error = shouldUseApi ? apiError : dbError;

  const threads = threadsData?.threads ?? [];
  const hasNextPage = shouldUseApi ? !!apiData?.nextPageToken : threads.length === 20;

  if (isAuthLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  function handleSearch() {
    setDebouncedQuery(searchQuery);
    setPageToken(undefined);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      if (shouldUseApi) {
        await refetchApi();
      } else {
        // Pull fresh data from Gmail into the Corsair cache, then invalidate the DB view.
        await refetchApi();
        await utils.gmail.listThreadsFromDb.invalidate();
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleNextPage() {
    if (shouldUseApi) {
      if (apiData?.nextPageToken) {
        setPageToken(apiData.nextPageToken);
      }
    } else {
      setDbOffset((prev) => prev + 20);
    }
  }

  function handlePrevPage() {
    if (shouldUseApi) {
      setPageToken(undefined);
    } else {
      setDbOffset((prev) => Math.max(0, prev - 20));
    }
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isApiFetching || isDbFetching}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Link href="/mail?compose=true">
            <Button size="sm">Compose</Button>
          </Link>
        </div>

        <CategoryTabs selectedCategory={selectedLabelId} onSelectCategory={setSelectedLabelId} />

        <ScrollArea className="flex-1">
          {isLoading || isRefreshing ? (
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
                  href={`${new URL(env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").origin}/auth/google`}
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {thread.subject || "(no subject)"}
                    </span>
                    {thread.from && (
                      <span className="text-xs text-muted-foreground truncate shrink-0 max-w-[40%]">
                        {thread.from}
                      </span>
                    )}
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
            disabled={shouldUseApi ? !pageToken : dbOffset === 0}
            onClick={handlePrevPage}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            {threads.length > 0 ? `${threads.length} conversations` : ""}
          </span>
          <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={handleNextPage}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
