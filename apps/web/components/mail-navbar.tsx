"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export type MailNavItem = {
  id: string | undefined;
  label: string;
};

const NAV_ITEMS: MailNavItem[] = [
  { id: undefined, label: "All mail" },
  { id: "CATEGORY_PERSONAL", label: "Primary" },
  { id: "CATEGORY_SOCIAL", label: "Social" },
  { id: "CATEGORY_PROMOTIONS", label: "Promotions" },
  { id: "CATEGORY_UPDATES", label: "Updates" },
  { id: "CATEGORY_FORUMS", label: "Forums" },
  { id: "SENT", label: "Sent" },
];

interface MailNavbarProps {
  selectedId?: string;
  onSelect?: (id: string | undefined) => void;
  className?: string;
}

export function MailNavbar({ selectedId, onSelect, className }: MailNavbarProps) {
  return (
    <nav
      className={cn(
        "flex items-center gap-2 border-b bg-background px-4 py-3 overflow-x-auto shadow-sm",
        className,
      )}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = selectedId === item.id;
        return (
          <Button
            key={item.id ?? "all"}
            variant={isActive ? "default" : "ghost"}
            size="default"
            className={cn(
              "shrink-0 rounded-full px-4 text-sm font-semibold transition-colors",
              !isActive && "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
            onClick={() => onSelect?.(item.id)}
          >
            {item.label}
          </Button>
        );
      })}
    </nav>
  );
}
