"use server";

import { getSessionContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { runAssistant, type AssistantMessage } from "@/lib/ai/run-assistant";

export interface AskAssistantResult {
  reply?: string;
  error?: string;
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

  const messages = [...history, { role: "assistant" as const, text: result.reply }];
  const { error: saveError } = await supabase.from("assistant_conversations").upsert(
    { user_id: ctx.profile.id, messages, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return {
    reply: result.reply,
    error: saveError ? "The answer was generated, but the conversation could not be saved." : undefined,
  };
}
