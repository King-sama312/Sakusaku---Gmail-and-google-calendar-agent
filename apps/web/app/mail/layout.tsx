import { ReactNode, Suspense } from "react";
import { MailSidebar } from "~/components/mail-sidebar";

export default function MailLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <Suspense fallback={<aside className="h-full w-56 border-r bg-muted/20" />}>
        <MailSidebar />
      </Suspense>
      <main className="flex-1 overflow-hidden min-h-0">{children}</main>
    </div>
  );
}
