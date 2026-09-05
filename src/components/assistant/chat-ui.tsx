"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AudioWaveform, Send, User, AlertCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, normalizeAssistantText } from "@/lib/utils";
import { askAssistantAction, transcribeAudioAction } from "@/app/(dashboard)/assistant/actions";
import type { AssistantMessage } from "@/lib/ai/run-assistant";

const EXAMPLE_PROMPTS = [
  "How many students were present today?",
  "What are Priya Sharma's test marks?",
  "Who has the highest pending fees?",
  "How much fee did we collect this week?",
  "List absent students in Batch A today",
];

export function AssistantChat({
  adminName,
  initialMessages,
}: {
  adminName: string;
  initialMessages: AssistantMessage[];
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  function send(text: string) {
    const question = text.trim();
    if (!question || isPending) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", text: question }];
    setMessages(nextMessages);
    setInput("");
    setError(null);

    startTransition(async () => {
      const result = await askAssistantAction(nextMessages);
      if (result.reply) {
        setMessages((prev) => [...prev, { role: "assistant", text: normalizeAssistantText(result.reply!) }]);
      }
      if (result.error) setError(result.error);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
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
        formData.append("audio", new Blob(chunks, { type: recorder.mimeType || "audio/webm" }), "recording.webm");
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

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] rounded-lg border border-border bg-card overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--brand-50)] text-[var(--brand-600)]">
              <AudioWaveform className="size-6" />
            </div>
            <div>
              <p className="font-medium">Ask about any student, batch, or number</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                I can look up attendance, fees, and test marks straight from your live data. I can&apos;t change anything — just answer questions.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted cursor-pointer transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className={m.role === "assistant" ? "bg-[var(--brand-100)] text-[var(--brand-800)]" : undefined}>
                {m.role === "assistant" ? <AudioWaveform className="size-3.5" /> : <User className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                m.role === "assistant" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
              )}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex gap-3">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-[var(--brand-100)] text-[var(--brand-800)]"><AudioWaveform className="size-3.5" /></AvatarFallback>
            </Avatar>
            <div className="rounded-lg px-3.5 py-2.5 bg-muted text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-[var(--danger-bg)] text-[var(--danger)] text-sm px-3 py-2.5 mx-11">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border p-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={`Ask a question, ${adminName.split(" ")[0]}…`}
          rows={1}
          className="resize-none min-h-10 max-h-32"
        />
        <Button
          type="button"
          size="icon"
          variant={isRecording ? "destructive" : "outline"}
          disabled={isPending || isTranscribing}
          onClick={toggleRecording}
          aria-label={isRecording ? "Stop recording" : "Record question"}
          title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing…" : "Record question"}
        >
          {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Button type="submit" size="icon" disabled={!input.trim() || isPending || isTranscribing} loading={isPending}>
          <Send className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
