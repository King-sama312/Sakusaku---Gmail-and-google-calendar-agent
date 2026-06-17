import { ReactNode } from "react";

export default function MailLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
