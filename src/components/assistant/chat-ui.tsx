"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeAssistantText } from "@/lib/utils";
import {
  askAssistantAction,
  clearChatAction,
  transcribeAudioAction,
} from "@/app/(dashboard)/assistant/actions";
import type { AssistantMessage } from "@/lib/ai/run-assistant";
import { ChatHeader } from "./chat-header";
import { ChatEmpty } from "./chat-empty";
import { ChatMessage, type ChatSuggestion } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

const FALLBACK_SUGGESTIONS: ChatSuggestion[] = [
  { label: "Attendance today", query: "How many students were present today?" },
  { label: "Highest pending fees", query: "Who has the highest pending fees?" },
  { label: "Priya's test marks", query: "What are Priya Sharma's test marks?" },
  { label: "Active batches", query: "List all active batches and their students." },
  { label: "Fees collected this week", query: "How much fee did we collect this week?" },
  { label: "Absentees in Batch A", query: "List absent students in Batch A today" },
];

let fallbackCursor = 0;

/** Picks 2 short, useful follow-up questions based on what the reply was about. */
function getFollowUps(reply: string): ChatSuggestion[] {
  const text = reply.toLowerCase();
  const picks: ChatSuggestion[] = [];
  const add = (suggestion: ChatSuggestion) => {
    if (!picks.some((pick) => pick.query === suggestion.query)) picks.push(suggestion);
  };

  if (/pending|fee|payment|rs\.|rupee|collect|paid/i.test(text)) {
    add({ label: "Who owes the most?", query: "Who has the highest pending fees?" });
    add({ label: "Collections this week", query: "How much fee did we collect this week?" });
  }
  if (/present|absent|attendance/i.test(text)) {
    add({ label: "Yesterday's attendance", query: "How many students were present yesterday?" });
    add({ label: "Absentees in Batch A", query: "List absent students in Batch A today" });
  }
  if (/mark|test|score|percent/i.test(text)) {
    add({ label: "Another student's marks", query: "What are Priya Sharma's test marks?" });
    add({ label: "Class performance", query: "How did the class do on the latest test?" });
  }
  if (/batch/i.test(text)) {
    add({ label: "All active batches", query: "List all active batches and their students." });
  }

  if (picks.length < 2) {
    for (let i = 0; i < FALLBACK_SUGGESTIONS.length && picks.length < 2; i++) {
      add(FALLBACK_SUGGESTIONS[(fallbackCursor + i) % FALLBACK_SUGGESTIONS.length]);
    }
    fallbackCursor = (fallbackCursor + 1) % FALLBACK_SUGGESTIONS.length;
  }

  return picks.slice(0, 2);
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-500),var(--brand-800))] text-white shadow-sm ring-2 ring-[var(--brand-100)]">
        <Sparkles className="size-3.5" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
        <span className="text-xs font-medium text-muted-foreground">Trippy is thinking</span>
        <span className="inline-flex gap-1" aria-hidden="true">
          <span className="size-1.5 rounded-full bg-[var(--brand-600)] animate-bounce [animation-delay:-0.3s]" />
          <span className="size-1.5 rounded-full bg-[var(--brand-600)] animate-bounce [animation-delay:-0.15s]" />
          <span className="size-1.5 rounded-full bg-[var(--brand-600)] animate-bounce" />
        </span>
      </div>
    </div>
  );
}

function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--danger-bg)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 leading-relaxed">{error}</div>
      {onRetry && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="shrink-0 text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function AssistantChat({
  adminName,
  initialMessages,
  canEdit = false,
}: {
  adminName: string;
  initialMessages: AssistantMessage[];
  canEdit?: boolean;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [followUps, setFollowUps] = useState<ChatSuggestion[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Only auto-scroll when the user is already near the bottom. If they scroll
  // upward to read older messages, keep their position stable instead of
  // snapping back to the latest reply.
  function handleScroll() {
    const element = scrollRef.current;
    if (!element) return;
    nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
  }

  useEffect(() => {
    if (!nearBottomRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  function send(text: string) {
    const question = String(text).trim();
    if (!question || isPending) return;

    setLastQuestion(question);
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setError(null);
    setFollowUps([]);

    startTransition(async () => {
      const result = await askAssistantAction([...messages, { role: "user", text: question }]);
      if (result.reply) {
        const reply = normalizeAssistantText(result.reply!);
        setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        setFollowUps(getFollowUps(reply));
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
      if (result.error) setError(result.error);
    });
  }

  async function toggleRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        setIsTranscribing(true);
        const formData = new FormData();
        formData.append(
          "audio",
          new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
          "recording.webm"
        );
        const result = await transcribeAudioAction(formData);
        setIsTranscribing(false);
        if (result.error) setError(result.error);
        else if (result.transcript) setInput(result.transcript);
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch {
      setError("Microphone access was denied or unavailable.");
    }
  }

  async function handleClearChat() {
    setClearOpen(false);
    setMessages([]);
    setFollowUps([]);
    setError(null);
    setInput("");
    setLastQuestion(null);
    const result = await clearChatAction();
    if (result?.error) setError(result.error);
  }

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") return i;
    }
    return -1;
  })();

  return (
    <>
      <div className="flex h-[calc(100vh-11rem)] min-h-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <ChatHeader
          hasMessages={messages.length > 0}
          onNewChat={() => setClearOpen(true)}
          disabled={isPending || isTranscribing}
          canEdit={canEdit}
        />

        {messages.length === 0 ? (
          <ChatEmpty adminName={adminName} onPick={send} disabled={isPending} />
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            aria-live="polite"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          >
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  message={message}
                  adminName={adminName}
                  isLast={index === lastAssistantIndex}
                  suggestions={index === lastAssistantIndex ? followUps : undefined}
                  onSuggestion={(query) => send(query)}
                  disabled={isPending}
                />
              ))}

              {isPending && <TypingIndicator />}

              {error && (
                <ErrorBanner
                  error={error}
                  onRetry={lastQuestion ? () => send(lastQuestion) : undefined}
                />
              )}
            </div>
          </div>
        )}

        <ChatComposer
          ref={textareaRef}
          input={input}
          onInputChange={setInput}
          onSubmit={() => send(input)}
          isPending={isPending}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          onToggleRecording={toggleRecording}
        />
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Start a new chat?"
        description="This clears the conversation shown here. It only deletes this chat — it won't touch any student, fee, attendance, or mark data."
        confirmLabel="Clear chat"
        destructive
        onConfirm={handleClearChat}
      />
    </>
  );
}