"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

export type MailNavItem = {
  id: string | undefined;
  label: string;
};

export const NAV_ITEMS: MailNavItem[] = [
  { id: undefined, label: "All mail" },
  { id: "CATEGORY_PERSONAL", label: "Primary" },
  { id: "CATEGORY_SOCIAL", label: "Social" },
  { id: "CATEGORY_PROMOTIONS", label: "Promotions" },
  { id: "CATEGORY_UPDATES", label: "Updates" },
  { id: "CATEGORY_FORUMS", label: "Forums" },
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
        "flex items-center gap-1 border-b bg-background px-3 py-2 shadow-sm",
        className,
      )}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = selectedId === item.id;
        return (
          <Button
            key={item.id ?? "all"}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            className={cn(
              "shrink-0 rounded-full px-3 text-xs font-semibold transition-colors",
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
