import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ASSISTANT_TOOL_DEFINITIONS, runAssistantTool } from "../tools";
import { SYSTEM_PROMPT, MAX_TOOL_ITERATIONS } from "../system-prompt";
import type { AssistantProvider } from "./types";

const ANTHROPIC_TOOLS: Anthropic.Tool[] = ASSISTANT_TOOL_DEFINITIONS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.schema,
}));

export const runAnthropicAssistant: AssistantProvider = async (supabase, history) => {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  let messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.text }));

  try {
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: ANTHROPIC_TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { reply: text || "I couldn't find an answer to that." };
      }

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: JSON.stringify(await runAssistantTool(supabase, block.name, block.input as Record<string, unknown>)),
        }))
      );

      messages = [...messages, { role: "assistant", content: response.content }, { role: "user", content: toolResults }];
    }

    return { error: "That question needed more lookups than I could do at once -- try breaking it into a simpler question." };
  } catch (err) {
    console.error("Anthropic assistant error:", err);
    return { error: "The assistant hit an error talking to Claude. Please try again." };
  }
};
