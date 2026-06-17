"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Inbox, Star, Send, FileText, Trash2 } from "lucide-react";

interface FolderItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const FOLDER_ITEMS: FolderItem[] = [
  { id: "inbox", label: "Inbox", href: "/mail", icon: <Inbox className="h-4 w-4" /> },
  {
    id: "starred",
    label: "Starred",
    href: "/mail?folder=starred",
    icon: <Star className="h-4 w-4" />,
  },
  { id: "sent", label: "Sent", href: "/mail?folder=sent", icon: <Send className="h-4 w-4" /> },
  { id: "drafts", label: "Drafts", href: "/mail/drafts", icon: <FileText className="h-4 w-4" /> },
  { id: "trash", label: "Trash", href: "/mail?folder=trash", icon: <Trash2 className="h-4 w-4" /> },
];

export function MailSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolder = searchParams.get("folder");

  const isActive = (item: FolderItem) => {
    if (item.id === "drafts") return pathname === "/mail/drafts";
    if (item.id === "inbox") return pathname === "/mail" && !currentFolder;
    return currentFolder === item.id;
  };

  return (
    <aside className="flex h-full w-56 flex-col border-r bg-muted/20">
      <div className="p-3">
        <Link href="/mail?compose=true" className="block">
          <Button className="w-full" size="sm">
            Compose
          </Button>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {FOLDER_ITEMS.map((item) => (
          <Button
            key={item.id}
            variant={isActive(item) ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "justify-start gap-3 px-3 text-sm font-medium",
              !isActive(item) && "text-muted-foreground hover:text-foreground",
            )}
            asChild
          >
            <Link href={item.href}>
              {item.icon}
              {item.label}
            </Link>
          </Button>
        ))}
      </nav>
    </aside>
  );
}
