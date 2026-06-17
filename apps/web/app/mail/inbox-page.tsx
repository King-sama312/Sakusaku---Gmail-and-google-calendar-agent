"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useGmailThreadsFromDb, useSyncThreadMetadata } from "~/hooks/api/gmail";
import { useRequireAuth } from "~/hooks/api/auth";
import { trpc } from "~/trpc/client";
import { env } from "~/env.js";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { MailNavbar, NAV_ITEMS } from "~/components/mail-navbar";
import { ComposeEmail } from "~/components/compose-email";

export function InboxPage() {
  const { user, isLoading: isAuthLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isComposeOpen = searchParams.get("compose") === "true";

  const folder = searchParams.get("folder") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  // Sidebar folders are lowercase URL params; Gmail system label IDs are uppercase.
  const selectedLabelId = folder?.toUpperCase() || category || undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dbOffset, setDbOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isReady = !isAuthLoading && !!user;

  // Reset pagination when search query, folder, or category changes.
  useEffect(() => {
    setDbOffset(0);
  }, [debouncedQuery, folder, category]);

  const syncThreadMetadata = useSyncThreadMetadata();
  const utils = trpc.useUtils();

  // Always read from the local metadata cache.
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
      labelIds: selectedLabelId ? [selectedLabelId] : undefined,
    },
    { enabled: isReady },
  );

  // Simple client-side search over cached threads.
  const threads = useMemo(() => {
    const all = dbData?.threads ?? [];
    if (!debouncedQuery) return all;
    const query = debouncedQuery.toLowerCase();
    return all.filter(
      (t) =>
        t.subject?.toLowerCase().includes(query) ||
        t.from?.toLowerCase().includes(query) ||
        t.snippet?.toLowerCase().includes(query),
    );
  }, [dbData?.threads, debouncedQuery]);

  const hasNextPage = threads.length === 20;

  const emptyStateMessage = (() => {
    if (folder) {
      const label = folder.charAt(0).toUpperCase() + folder.slice(1);
      return `No ${label.toLowerCase()} emails`;
    }
    if (category) {
      const label = NAV_ITEMS.find((item) => item.id === category)?.label ?? category;
      return `No ${label.toLowerCase()} emails`;
    }
    if (debouncedQuery) return "No conversations match your search";
    return "No conversations found";
  })();

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
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await syncThreadMetadata.mutateAsync({
        maxResults: 100,
        labelIds: selectedLabelId ? [selectedLabelId] : undefined,
      });
      await utils.gmail.listThreadsFromDb.invalidate();
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleNextPage() {
    setDbOffset((prev) => prev + 20);
  }

  function handlePrevPage() {
    setDbOffset((prev) => Math.max(0, prev - 20));
  }

  return (
    <div className="flex h-full flex-col">
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
          disabled={isRefreshing || isDbFetching}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {!folder && (
        <MailNavbar
          selectedId={category}
          onSelect={(id) => {
            if (id) {
              router.replace(`/mail?category=${id}`);
            } else {
              router.replace("/mail");
            }
          }}
        />
      )}

      <ScrollArea className="flex-1">
        {isDbLoading || isRefreshing ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isDbError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-sm">
            <p className="text-destructive font-medium">Failed to load conversations</p>
            <p className="text-muted-foreground text-xs max-w-md text-center">
              {dbError?.message ?? "An unknown error occurred"}
            </p>
            {dbError?.message?.toLowerCase().includes("account not found") && (
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
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <p>{emptyStateMessage}</p>
            {selectedLabelId && (
              <Button variant="ghost" size="sm" onClick={() => router.replace("/mail")}>
                Back to Inbox
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {isDbFetching && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground bg-muted/30">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Updating…
              </div>
            )}
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
                <p className="text-xs text-muted-foreground line-clamp-1">{thread.snippet || ""}</p>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between border-t p-3">
        <Button
          variant="outline"
          size="sm"
          disabled={dbOffset === 0}
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

      <Dialog open={isComposeOpen} onOpenChange={(open) => !open && router.replace("/mail")}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
          </DialogHeader>
          <ComposeEmail
            onSuccess={() => router.replace("/mail")}
            onCancel={() => router.replace("/mail")}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
