"use client";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useGmailLabels, useCreateLabel, useDeleteLabel } from "~/hooks/api/gmail";
import { useState } from "react";
import { Input } from "~/components/ui/input";

interface MailLabelsProps {
  selectedLabelId?: string;
  onSelectLabel?: (labelId: string | undefined) => void;
  className?: string;
}

export function MailLabels({ selectedLabelId, onSelectLabel, className }: MailLabelsProps) {
  const { data: labelsData, isLoading } = useGmailLabels();
  const { mutateAsync: createLabel } = useCreateLabel();
  const { mutateAsync: deleteLabel } = useDeleteLabel();
  const [isCreating, setIsCreating] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");

  const labels = labelsData?.labels ?? [];

  async function handleCreateLabel() {
    if (!newLabelName.trim()) return;
    await createLabel({ name: newLabelName.trim() });
    setNewLabelName("");
    setIsCreating(false);
  }

  async function handleDeleteLabel(id: string) {
    await deleteLabel({ id });
    if (selectedLabelId === id) onSelectLabel?.(undefined);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold">Labels</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
          +
        </Button>
      </div>

      {isCreating && (
        <div className="flex gap-1 px-2">
          <Input
            placeholder="Label name"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateLabel();
            }}
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7" onClick={handleCreateLabel}>
            Add
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-1">
          <Button
            variant={!selectedLabelId ? "secondary" : "ghost"}
            size="sm"
            className="justify-start text-xs"
            onClick={() => onSelectLabel?.(undefined)}
          >
            All inbox
          </Button>
          {labels.map((label) => (
            <div key={label.id} className="group flex items-center">
              <Button
                variant={selectedLabelId === label.id ? "secondary" : "ghost"}
                size="sm"
                className="flex-1 justify-start text-xs"
                onClick={() => onSelectLabel?.(label.id)}
              >
                {label.name}
              </Button>
              {label.type === "user" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 opacity-0 group-hover:opacity-100"
                  onClick={() => label.id && handleDeleteLabel(label.id)}
                >
                  x
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
