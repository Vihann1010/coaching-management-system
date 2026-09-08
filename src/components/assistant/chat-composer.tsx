"use client";

import { forwardRef, useEffect, useRef } from "react";
import { CornerDownLeft, Loader2, Mic, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  onToggleRecording: () => void;
}

export const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(function ChatComposer(
  { input, onInputChange, onSubmit, isPending, isRecording, isTranscribing, onToggleRecording },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function setTextareaRef(element: HTMLTextAreaElement | null) {
    innerRef.current = element;
    if (typeof ref === "function") {
      ref(element);
    } else if (ref) {
      ref.current = element;
    }
  }

  // Auto-grow the input up to ~5 lines, then let it scroll.
  useEffect(() => {
    const element = innerRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [input]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isPending && !isTranscribing) onSubmit();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-card/50 px-3 pb-3 pt-3 sm:px-4">
      {isRecording && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--danger-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--danger)]">
          <span className="relative flex size-2.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--danger)] opacity-60"
              aria-hidden="true"
            />
            <span className="relative inline-flex size-2.5 rounded-full bg-[var(--danger)]" />
          </span>
          Recording — tap the mic to stop and ask
        </div>
      )}

      {isTranscribing && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--info-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--info)]">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          Transcribing your voice…
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isPending && !isTranscribing) onSubmit();
        }}
        className="flex items-end gap-1.5 rounded-2xl border border-input bg-card p-1.5 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring"
      >
        <Textarea
          ref={setTextareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about students, attendance, fees, marks…"
          rows={1}
          aria-label="Ask the AI assistant"
          className="min-h-10 max-h-32 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
        />

        <Button
          type="button"
          size="icon"
          variant={isRecording ? "destructive" : "ghost"}
          disabled={isRecording ? false : isPending || isTranscribing}
          onClick={onToggleRecording}
          aria-label={isRecording ? "Stop recording" : isTranscribing ? "Transcribing" : "Record with your voice"}
          title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing…" : "Record your question with your voice"}
          className="relative shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        >
          {isRecording && (
            <span
              className="absolute inset-0 animate-ping rounded-full bg-[var(--danger)] opacity-30"
              aria-hidden="true"
            />
          )}
          {isTranscribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isRecording ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </Button>

        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isPending || isTranscribing}
          loading={isPending}
          className="shrink-0 rounded-full"
        >
          {isPending ? null : <Send className="size-4" />}
          <span className="sr-only">Send message</span>
        </Button>
      </form>

      <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <CornerDownLeft className="size-3" />
        Enter to send · Shift + Enter for a new line · Mic for voice
      </p>
    </div>
  );
});