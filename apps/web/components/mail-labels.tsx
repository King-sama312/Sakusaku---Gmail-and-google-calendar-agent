"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useGmailLabels } from "~/hooks/api/gmail";
import {
  GMAIL_CATEGORIES,
  getCategoryDisplayName,
  isGmailCategory,
} from "~/lib/gmail-categories";

interface MailLabelsProps {
  selectedLabelId?: string;
  onSelectLabel?: (labelId: string | undefined) => void;
  className?: string;
}

export function MailLabels({ selectedLabelId, onSelectLabel, className }: MailLabelsProps) {
  const { data: labelsData } = useGmailLabels();

  const labels = labelsData?.labels ?? [];

  // Filter to only show Gmail category labels
  const categoryLabels = labels.filter(
    (label) => label.id && isGmailCategory(label.id),
  );

  // Sort categories in a consistent order
  const sortedLabels = categoryLabels.sort((a, b) => {
    const order = Object.keys(GMAIL_CATEGORIES);
    const aIndex = a.id ? order.indexOf(a.id) : -1;
    const bIndex = b.id ? order.indexOf(b.id) : -1;
    return aIndex - bIndex;
  });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold">Categories</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-1">
          <Button
            variant={!selectedLabelId ? "secondary" : "ghost"}
            size="sm"
            className="justify-start text-xs"
            onClick={() => onSelectLabel?.(undefined)}
          >
            All mail
          </Button>
          {sortedLabels.map((label) => {
            const displayName = label.id
              ? getCategoryDisplayName(label.id)
              : label.name;
            return (
              <Button
                key={label.id}
                variant={selectedLabelId === label.id ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 justify-start text-xs"
                onClick={() => label.id && onSelectLabel?.(label.id)}
              >
                {displayName || label.name}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
