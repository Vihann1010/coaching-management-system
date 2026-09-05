"use server";

import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, type AssistantMessage } from "@/lib/ai/run-assistant";
import { normalizeAssistantText } from "@/lib/utils";

export interface AskAssistantResult {
  reply?: string;
  error?: string;
}

export interface SpeechResult {
  transcript?: string;
  error?: string;
}

async function requireAdmin() {
  const ctx = await getSessionContext();
  return ctx.profile.role === "admin" ? ctx : null;
}

async function sarvamRequest(path: string, init: RequestInit) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error("SARVAM_API_KEY is not configured.");

  return fetch(`https://api.sarvam.ai/${path}`, {
    ...init,
    headers: { "api-subscription-key": apiKey, ...init.headers },
  });
}

export async function transcribeAudioAction(formData: FormData): Promise<SpeechResult> {
  if (!await requireAdmin()) return { error: "Only an admin can use the assistant." };

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return { error: "No recording was received." };

  try {
    const body = new FormData();
    body.append("file", audio, audio.name || "recording.webm");
    body.append("model", "saaras:v4");
    body.append("mode", "transcribe");

    const response = await sarvamRequest("speech-to-text", { method: "POST", body });
    const data = await response.json() as { transcript?: string; error?: { message?: string } };
    if (!response.ok) return { error: data.error?.message ?? "Sarvam could not transcribe that recording." };
    return { transcript: data.transcript?.trim() ?? "" };
  } catch (error) {
    console.error("Sarvam STT error:", error);
    return { error: error instanceof Error ? error.message : "Speech recognition failed." };
  }
}


export async function askAssistantAction(history: AssistantMessage[]): Promise<AskAssistantResult> {
  const ctx = await getSessionContext();

  // Defense in depth: a Server Action is a real network endpoint, callable
  // directly, not just through the gated page. Re-check here even though
  // the /assistant page also checks, so this stays safe even if the
  // route-level gate is ever changed or bypassed.
  if (ctx.profile.role !== "admin") {
    return { error: "Only an admin can use the assistant." };
  }

  if (history.length === 0 || history[history.length - 1]?.role !== "user") {
    return { error: "No question to answer." };
  }

  const supabase = await createClient();
  const result = await runAssistant(supabase, history);

  if ("error" in result) return { error: result.error };

  const reply = normalizeAssistantText(result.reply);
  const messages = [...history, { role: "assistant" as const, text: reply }];
  const { error: saveError } = await supabase.from("assistant_conversations").upsert(
    { user_id: ctx.profile.id, messages, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return {
    reply,
    error: saveError ? "The answer was generated, but the conversation could not be saved." : undefined,
  };
}
