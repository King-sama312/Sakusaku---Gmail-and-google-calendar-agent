"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useSendMessage,
  useConversations,
  useConversation,
  useDeleteConversation,
  type ChatMessage,
} from "~/hooks/api/chat";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { Trash2, Menu, Plus, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialConversationId = searchParams.get("id") ?? undefined;

  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId ?? undefined,
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const justSentRef = useRef(false);

  const { data: conversations, isLoading: isConversationsLoading } = useConversations();
  const { data: conversationData, isLoading: isConversationLoading } =
    useConversation(conversationId);
  const sendMessage = useSendMessage();
  const deleteConversation = useDeleteConversation();

  useEffect(() => {
    setConversationId(initialConversationId ?? undefined);
  }, [initialConversationId]);

  useEffect(() => {
    if (conversationData?.messages) {
      const loadedMessages: ChatMessage[] = conversationData.messages.map((m) => ({
        role: m.role,
        content: m.content ?? undefined,
        toolCallId: m.toolCallId ?? undefined,
        toolName: m.toolName ?? undefined,
      }));
      setMessages(loadedMessages);
    } else {
      setMessages([]);
    }
  }, [conversationData]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) return;

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceFromBottom < 100;

    if (isNearBottom || justSentRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      justSentRef.current = false;
    }
  }, [messages, isThinking]);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isThinking) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsThinking(true);
    justSentRef.current = true;

    try {
      const response = await sendMessage.mutateAsync({
        conversationId,
        message: text,
      });

      setConversationId(response.conversationId);
      if (!conversationId) {
        router.replace(`/chat?id=${response.conversationId}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.content,
        },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to get a response");
      setMessages((prev) => prev.filter((m) => m !== userMessage));
    } finally {
      setIsThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConversation.mutateAsync({ id });
      if (conversationId === id) {
        setConversationId(undefined);
        setMessages([]);
        router.replace("/chat");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation");
    }
  }

  const conversationList = conversations ?? [];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar for larger screens */}
      <aside className="hidden w-72 flex-col border-r bg-muted/30 md:flex">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold">Conversations</h2>
          <Link href="/chat">
            <Button variant="ghost" size="icon" onClick={() => setConversationId(undefined)}>
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <ScrollArea className="flex-1">
          {isConversationsLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : conversationList.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
          ) : (
            <div className="space-y-1 p-2">
              {conversationList.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer ${
                    conversationId === conv.id ? "bg-muted" : ""
                  }`}
                  onClick={() => {
                    setConversationId(conv.id);
                    router.replace(`/chat?id=${conv.id}`);
                  }}
                >
                  <span className="truncate pr-2">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Mobile sheet */}
      <div className="md:hidden absolute left-3 top-3 z-10">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-80px)]">
              <div className="space-y-1 p-2">
                <Link href="/chat">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setConversationId(undefined)}
                  >
                    <Plus className="mr-2 h-4 w-4" /> New chat
                  </Button>
                </Link>
                {conversationList.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer ${
                      conversationId === conv.id ? "bg-muted" : ""
                    }`}
                    onClick={() => {
                      setConversationId(conv.id);
                      router.replace(`/chat?id=${conv.id}`);
                    }}
                  >
                    <span className="truncate pr-2">{conv.title}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(conv.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main chat area */}
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-none items-center justify-between border-b px-4 py-3 md:px-6">
          <div className="ml-10 md:ml-0">
            <h1 className="font-semibold">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">
              Ask about your inbox, schedule, or let Sakuchan act on your behalf.
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              Dashboard
            </Button>
          </Link>
        </header>

        <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1 px-4 py-4 md:px-6">
          {isConversationLoading && conversationId ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-3/4" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Bot className="mb-3 h-10 w-10" />
              <p className="text-sm">Start a conversation with Sakuchan</p>
              <p className="text-xs">Try: “What does my inbox look like today?”</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {m.role !== "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {m.content ? (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        <p className="italic text-muted-foreground">Thinking…</p>
                      )}
                    </div>
                    {m.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
              {isThinking && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-muted px-4 py-2 text-sm">
                    <div className="flex gap-1">
                      <span className="animate-bounce">.</span>
                      <span className="animate-bounce delay-100">.</span>
                      <span className="animate-bounce delay-200">.</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="flex flex-none items-end gap-2 border-t bg-background p-3 md:p-4"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Sakuchan anything…"
            className="min-h-[44px] resize-none"
            rows={1}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isThinking}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </main>
    </div>
  );
}
