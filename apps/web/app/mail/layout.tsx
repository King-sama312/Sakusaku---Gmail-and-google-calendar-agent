import { ReactNode } from "react";

export default function MailLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r bg-muted/30 p-3 hidden md:block">
        <MailSidebar />
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function MailSidebar() {
  return (
    <div className="flex flex-col gap-4">
      <a
        href="/mail"
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Inbox
      </a>
      <a
        href="/mail/drafts"
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        Drafts
      </a>
    </div>
  );
}
