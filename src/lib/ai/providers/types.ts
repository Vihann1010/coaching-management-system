import type { createClient } from "@/lib/supabase/server";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
}

export type ProviderResult = { reply: string } | { error: string };

/** Every provider adapter (Anthropic, Gemini, ...) implements this one function. */
export type AssistantProvider = (
  supabase: SupabaseServerClient,
  history: AssistantMessage[]
) => Promise<ProviderResult>;
