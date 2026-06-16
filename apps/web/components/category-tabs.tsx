"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { GMAIL_CATEGORIES } from "~/lib/gmail-categories";

interface CategoryTabsProps {
  selectedCategory?: string;
  onSelectCategory?: (categoryId: string | undefined) => void;
  className?: string;
}

const categories = Object.entries(GMAIL_CATEGORIES).map(([id, name]) => ({
  id,
  name,
}));

export function CategoryTabs({
  selectedCategory,
  onSelectCategory,
  className,
}: CategoryTabsProps) {
  return (
    <div className={cn("flex items-center gap-1 border-b px-4 overflow-x-auto", className)}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-none border-b-2 border-transparent px-3 text-xs font-medium",
          !selectedCategory && "border-primary text-primary",
        )}
        onClick={() => onSelectCategory?.(undefined)}
      >
        All mail
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant="ghost"
          size="sm"
          className={cn(
            "rounded-none border-b-2 border-transparent px-3 text-xs font-medium",
            selectedCategory === category.id && "border-primary text-primary",
          )}
          onClick={() => onSelectCategory?.(category.id)}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
