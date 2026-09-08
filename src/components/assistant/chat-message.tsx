"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { AssistantMessage } from "@/lib/ai/run-assistant";

export interface ChatSuggestion {
  label: string;
  query: string;
}

export function ChatMessage({
  message,
  adminName,
  isLast,
  suggestions,
  onSuggestion,
  disabled,
}: {
  message: AssistantMessage;
  adminName: string;
  isLast?: boolean;
  suggestions?: ChatSuggestion[];
  onSuggestion?: (query: string) => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable in older browsers — nothing else to do.
    }
  }

  return (
    <div
      className={cn(
        "flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200 sm:gap-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-500),var(--brand-800))] text-white shadow-sm ring-2 ring-[var(--brand-100)]">
          <Sparkles className="size-3.5" />
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%]",
          isAssistant ? "items-start" : "items-end"
        )}
      >
        {isAssistant && (
          <p className="mb-1 px-1 text-[11px] font-semibold text-[var(--brand-700)]">Trippy</p>
        )}

        <div
          className={cn(
            "group relative whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
            isAssistant
              ? "rounded-tl-sm border border-border bg-card text-foreground"
              : "rounded-tr-sm bg-primary text-primary-foreground"
          )}
        >
          {message.text}

          {isAssistant && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy answer"
              title="Copy answer"
              className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-all hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              {copied ? (
                <Check className="size-3.5 text-[var(--success)]" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          )}
        </div>

        {isAssistant && isLast && suggestions && suggestions.length > 0 && !disabled && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.query}
                type="button"
                onClick={() => onSuggestion?.(suggestion.query)}
                className="cursor-pointer rounded-full border border-[var(--brand-100)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-medium text-[var(--brand-800)] transition-colors hover:bg-[var(--brand-100)]"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isAssistant && (
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarFallback className="bg-[var(--brand-100)] text-[var(--brand-800)] text-xs">
            {initials(adminName)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}