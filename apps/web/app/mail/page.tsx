import { Suspense } from "react";
import { InboxPage } from "./inbox-page";

export default function MailInboxPage() {
  return (
    <Suspense fallback={<div className="h-full bg-background" />}>
      <InboxPage />
    </Suspense>
  );
}
