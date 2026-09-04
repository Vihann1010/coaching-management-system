import "server-only";
import type { AssistantMessage, ProviderResult, SupabaseServerClient } from "./providers/types";

export type { AssistantMessage };

/**
 * Provider selection: explicit AI_PROVIDER env var wins; otherwise
 * whichever API key is present decides. If both are set, Anthropic is
 * the default to keep behavior predictable — set AI_PROVIDER=gemini to
 * prefer Gemini instead.
 */
function selectProvider(): "anthropic" | "gemini" | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "gemini") return explicit;

  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export async function runAssistant(
  supabase: SupabaseServerClient,
  history: AssistantMessage[]
): Promise<ProviderResult> {
  const provider = selectProvider();

  if (!provider) {
    return {
      error:
        "The AI assistant isn't configured yet. An admin needs to add either ANTHROPIC_API_KEY or GEMINI_API_KEY (see README).",
    };
  }

  if (provider === "gemini") {
    const { runGeminiAssistant } = await import("./providers/gemini");
    return runGeminiAssistant(supabase, history);
  }

  const { runAnthropicAssistant } = await import("./providers/anthropic");
  return runAnthropicAssistant(supabase, history);
}
