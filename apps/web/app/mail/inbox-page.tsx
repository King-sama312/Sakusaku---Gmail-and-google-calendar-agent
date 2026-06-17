"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useGmailThreadsFromDb,
  useSyncThreadMetadata,
  useStarThread,
  useUnstarThread,
  useTrashThread,
} from "~/hooks/api/gmail";
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
import { cn } from "~/lib/utils";
import { Star, Trash2 } from "lucide-react";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Thread = {
  id?: string;
  snippet?: string;
  historyId?: string;
  subject?: string;
  from?: string;
  labelIds?: string[];
  date?: string;
};

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

  // OPTIMISTIC UI STATE
  const [optimisticStars, setOptimisticStars] = useState<Record<string, boolean>>({});
  const [hiddenThreads, setHiddenThreads] = useState<Set<string>>(new Set());

  const isReady = !isAuthLoading && !!user;

  const syncThreadMetadata = useSyncThreadMetadata();
  const starThread = useStarThread();
  const unstarThread = useUnstarThread();
  const trashThread = useTrashThread();
  const utils = trpc.useUtils();

  const queryInput = {
    limit: 20,
    offset: dbOffset,
    labelIds: selectedLabelId ? [selectedLabelId] : undefined,
  };

  // Reset pagination and optimistic state when the view changes.
  // Also invalidate the cache so the new folder always fetches fresh data.
  useEffect(() => {
    setDbOffset(0);
    setOptimisticStars({});
    setHiddenThreads(new Set());
    void utils.gmail.listThreadsFromDb.invalidate(queryInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, folder, category]);

  // Always read from the local metadata cache.
  const {
    data: dbData,
    isLoading: isDbLoading,
    isFetching: isDbFetching,
    isError: isDbError,
    error: dbError,
  } = useGmailThreadsFromDb(queryInput, { enabled: isReady });

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

  const visibleThreads = useMemo(
    () => threads.filter((t) => !hiddenThreads.has(t.id ?? "")),
    [threads, hiddenThreads],
  );

  const hasNextPage = visibleThreads.length === 20;

  // Update labelIds in the React Query cache for a single thread.
  const patchThreadLabels = (threadId: string, patch: (labels: string[]) => string[]) => {
    utils.gmail.listThreadsFromDb.setData(queryInput, (old) => {
      if (!old) return old;
      return {
        ...old,
        threads: (old.threads ?? []).map((t) => {
          if (t.id !== threadId) return t;
          return { ...t, labelIds: patch(t.labelIds ? [...t.labelIds] : []) };
        }),
      };
    });
  };

  const handleStarClick = (thread: Thread) => {
    const threadId = thread.id ?? "";
    const currentlyStarred = thread.labelIds?.includes("STARRED") ?? false;
    const nextStarred = !currentlyStarred;
    const isStarredFolder = selectedLabelId === "STARRED";

    // 1. Instant visual feedback.
    setOptimisticStars((prev) => ({ ...prev, [threadId]: nextStarred }));
    if (!nextStarred && isStarredFolder) {
      setHiddenThreads((prev) => new Set(prev).add(threadId));
    }

    // 2. Update the cache immediately so other views stay in sync.
    patchThreadLabels(threadId, (labels) => {
      if (nextStarred) {
        if (!labels.includes("STARRED")) labels.push("STARRED");
      } else {
        const idx = labels.indexOf("STARRED");
        if (idx !== -1) labels.splice(idx, 1);
      }
      return labels;
    });

    // 3. Fire the API call.
    const mutation = nextStarred ? starThread : unstarThread;
    mutation.mutate(
      { threadId },
      {
        onError: () => {
          // Rollback.
          setOptimisticStars((prev) => {
            const next = { ...prev };
            delete next[threadId];
            return next;
          });
          if (!nextStarred && isStarredFolder) {
            setHiddenThreads((prev) => {
              const next = new Set(prev);
              next.delete(threadId);
              return next;
            });
          }
          patchThreadLabels(threadId, (labels) => {
            if (currentlyStarred) {
              if (!labels.includes("STARRED")) labels.push("STARRED");
            } else {
              const idx = labels.indexOf("STARRED");
              if (idx !== -1) labels.splice(idx, 1);
            }
            return labels;
          });
          toast.error("Failed to update star");
        },
        onSuccess: () => {
          // Cache already matches; clear the override.
          setOptimisticStars((prev) => {
            const next = { ...prev };
            delete next[threadId];
            return next;
          });
          if (!nextStarred && isStarredFolder) {
            setHiddenThreads((prev) => {
              const next = new Set(prev);
              next.delete(threadId);
              return next;
            });
          }
        },
      },
    );
  };

  const handleTrashClick = (thread: Thread) => {
    const threadId = thread.id ?? "";

    // 1. Instant visual feedback — hide the row.
    setHiddenThreads((prev) => new Set(prev).add(threadId));

    // 2. Update the cache immediately.
    patchThreadLabels(threadId, (labels) => {
      if (!labels.includes("TRASH")) labels.push("TRASH");
      const idx = labels.indexOf("INBOX");
      if (idx !== -1) labels.splice(idx, 1);
      return labels;
    });

    // 3. Fire the API call.
    trashThread.mutate(
      { threadId },
      {
        onError: () => {
          // Rollback.
          setHiddenThreads((prev) => {
            const next = new Set(prev);
            next.delete(threadId);
            return next;
          });
          patchThreadLabels(threadId, (labels) => {
            if (!labels.includes("INBOX")) labels.push("INBOX");
            const idx = labels.indexOf("TRASH");
            if (idx !== -1) labels.splice(idx, 1);
            return labels;
          });
          toast.error("Failed to move to trash");
        },
        onSuccess: () => {
          setHiddenThreads((prev) => {
            const next = new Set(prev);
            next.delete(threadId);
            return next;
          });
        },
      },
    );
  };

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
    <div className="flex h-full min-h-0 flex-col">
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

      <ScrollArea className="flex-1 min-h-0">
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
        ) : visibleThreads.length === 0 ? (
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
            {visibleThreads.map((thread) => {
              const actualStarred = thread.labelIds?.includes("STARRED") ?? false;
              const optimisticStar = optimisticStars[thread.id ?? ""];
              const isStarred = optimisticStar !== undefined ? optimisticStar : actualStarred;

              return (
                <div
                  key={thread.id}
                  className="group flex flex-col gap-1 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/mail/${thread.id}`}
                      className="flex-1 min-w-0 flex items-center gap-2"
                    >
                      <span className="text-sm font-medium truncate">
                        {thread.subject || "(no subject)"}
                      </span>
                    </Link>
                    {/*
                      HOVER META AREA — fixed-height container with absolutely-positioned children.
                      The date/from layer defines the geometry. On hover it fades out and the
                      action-button layer fades in on top, so the row width/height never changes.
                    */}
                    <div className="relative flex items-center shrink-0 h-7">
                      <div className="flex items-center gap-2 h-full pr-0 transition-opacity duration-150 group-hover:opacity-0">
                        {thread.date && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(thread.date)}
                          </span>
                        )}
                        {thread.from && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {thread.from}
                          </span>
                        )}
                      </div>
                      <div className="absolute right-0 top-0 h-full flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStarClick(thread);
                          }}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4",
                              isStarred
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground",
                            )}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTrashClick(thread);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Link href={`/mail/${thread.id}`} className="block">
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {thread.snippet || ""}
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between border-t p-3">
        <Button variant="outline" size="sm" disabled={dbOffset === 0} onClick={handlePrevPage}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          {visibleThreads.length > 0 ? `${visibleThreads.length} conversations` : ""}
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
