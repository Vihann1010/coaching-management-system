"use client";

import { PencilLine, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatHeader({
  hasMessages,
  onNewChat,
  disabled,
  canEdit,
}: {
  hasMessages: boolean;
  onNewChat: () => void;
  disabled?: boolean;
  canEdit?: boolean;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-500),var(--brand-800))] text-white shadow-sm">
          <Sparkles className="size-4" />
          <span
            className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[var(--success)] ring-2 ring-card"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate font-[family-name:var(--font-display)] text-sm font-bold leading-tight text-[var(--brand-900)]">
            Trippy — Your AI Staff
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Reads live data
            <span className="size-0.5 rounded-full bg-muted-foreground" aria-hidden="true" />
            {canEdit ? "can update records with your yes" : "can't change anything"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {canEdit ? (
          <span className="hidden items-center gap-1 rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--success)] sm:inline-flex">
            <PencilLine className="size-3" />
            Read &amp; write
          </span>
        ) : (
          <span className="hidden items-center gap-1 rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-700)] sm:inline-flex">
            <ShieldCheck className="size-3" />
            Read-only
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChat}
          disabled={disabled || !hasMessages}
          title={hasMessages ? "Start a new chat" : "Your chat is already empty"}
          className="rounded-full text-xs"
        >
          <RotateCcw className="size-3.5" />
          New chat
        </Button>
      </div>
    </header>
  );
}