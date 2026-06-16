"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  parseMessage,
  getEmailBodyText,
} from "~/lib/email";

interface EmailViewerProps {
  message: Record<string, unknown>;
  className?: string;
}

export function EmailViewer({ message, className }: EmailViewerProps) {
  const [showHtml, setShowHtml] = useState(false);
  const parsed = parseMessage(message);
  const { headers, content, snippet } = parsed;

  const from = headers.from || "Unknown sender";
  const to = headers.to;
  const cc = headers.cc;
  const subject = headers.subject || "(no subject)";
  const date = headers.date;
  const hasHtml = !!content.textHtml;
  const hasPlain = !!content.textPlain;

  const displayContent = showHtml ? content.textHtml : getEmailBodyText(parsed);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold truncate">{subject}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-foreground">
                {from}
              </span>
              {date && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(date).toLocaleString()}
                </span>
              )}
            </div>
            {to && (
              <p className="text-xs text-muted-foreground mt-0.5">
                To: {to}
              </p>
            )}
            {cc && (
              <p className="text-xs text-muted-foreground">Cc: {cc}</p>
            )}
          </div>
          {hasHtml && hasPlain && (
            <div className="flex gap-1 shrink-0">
              <Button
                variant={!showHtml ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowHtml(false)}
              >
                Text
              </Button>
              <Button
                variant={showHtml ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowHtml(true)}
              >
                HTML
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {showHtml && content.textHtml ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.textHtml) }}
          />
        ) : (
          <div className="text-sm whitespace-pre-wrap break-words">
            {displayContent || snippet || "(no content)"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Basic HTML sanitization to prevent XSS.
 * Allows common formatting tags, removes scripts and event handlers.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}
