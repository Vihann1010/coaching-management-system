import "server-only";
import { GoogleGenAI } from "@google/genai";
import { ASSISTANT_TOOL_DEFINITIONS, runAssistantTool } from "../tools";
import { SYSTEM_PROMPT, MAX_TOOL_ITERATIONS } from "../system-prompt";
import type { AssistantProvider } from "./types";

const GEMINI_TOOLS = ASSISTANT_TOOL_DEFINITIONS.map((t) => ({
  type: "function" as const,
  name: t.name,
  description: t.description,
  parameters: t.schema,
}));

interface FunctionCallStep {
  type: "function_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export const runGeminiAssistant: AssistantProvider = async (supabase, history) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  // The Interactions API's documented multi-turn story is built around
  // previous_interaction_id (Google stores the turn server-side) and a
  // stateless mode whose exact "replay a plain-text assistant turn from
  // three questions ago" schema isn't part of the stable surface we
  // could confirm. Rather than guess at an undocumented step shape,
  // prior turns are folded into the new question as plain text --
  // Gemini still has full context, it just isn't using the fancier
  // structured-history mechanism. Tool-call resolution *within* this
  // single question (the part that matters for correctness) does use
  // the documented previous_interaction_id + function_result flow.
  const priorTurns = history.slice(0, -1);
  const latest = history[history.length - 1];

  const transcript = priorTurns.map((m) => `${m.role === "user" ? "Admin" : "Assistant"}: ${m.text}`).join("\n");
  const questionText = transcript
    ? `Earlier in this conversation:\n${transcript}\n\nAdmin's new question: ${latest.text}`
    : latest.text;

  try {
    let interaction = await ai.interactions.create({
      model,
      input: questionText,
      system_instruction: SYSTEM_PROMPT,
      tools: GEMINI_TOOLS,
      stream: false,
    });

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const functionCalls = (interaction.steps ?? []).filter(
        (s): s is FunctionCallStep => s.type === "function_call"
      );

      if (functionCalls.length === 0) {
        const text = interaction.output_text?.trim();
        return { reply: text || "I couldn't find an answer to that." };
      }

      const results = await Promise.all(
        functionCalls.map(async (fc) => ({
          type: "function_result" as const,
          name: fc.name,
          call_id: fc.id,
          result: [{ type: "text" as const, text: JSON.stringify(await runAssistantTool(supabase, fc.name, fc.arguments)) }],
        }))
      );

      interaction = await ai.interactions.create({
        model,
        previous_interaction_id: interaction.id,
        tools: GEMINI_TOOLS,
        input: results,
        stream: false,
      });
    }

    return { error: "That question needed more lookups than I could do at once -- try breaking it into a simpler question." };
  } catch (err) {
    console.error("Gemini assistant error:", err);
    return { error: "The assistant hit an error talking to Gemini. Please try again." };
  }
};
