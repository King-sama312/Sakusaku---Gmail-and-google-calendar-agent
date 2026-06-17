import { Suspense } from "react";
import ChatPage from "./chat-page";
import { Skeleton } from "~/components/ui/skeleton";

export default function ChatPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      }
    >
      <ChatPage />
    </Suspense>
  );
}
