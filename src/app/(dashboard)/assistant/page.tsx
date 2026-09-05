import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { AssistantChat } from "@/components/assistant/chat-ui";
import { createClient } from "@/lib/supabase/server";
import { normalizeAssistantText } from "@/lib/utils";
import type { AssistantMessage } from "@/lib/ai/run-assistant";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "assistant", "view"); // admin-only
  const supabase = await createClient();
  const { data: savedConversation } = await supabase
    .from("assistant_conversations")
    .select("messages")
    .eq("user_id", ctx.profile.id)
    .maybeSingle();
  const initialMessages = (Array.isArray(savedConversation?.messages)
    ? savedConversation.messages.filter(isAssistantMessage).map((message) => ({
        ...message,
        text: normalizeAssistantText(message.text),
      }))
    : []) as AssistantMessage[];

  return (
    <div>
      <PageHeader
        title="Trippy-Your Ai Staff"
        description="Ask about students, attendance, fees, or test marks — answered from live data. Read-only: it can't change anything."
      />
      <AssistantChat adminName={ctx.profile.full_name} initialMessages={initialMessages} />
    </div>
  );
}

function isAssistantMessage(value: unknown): value is AssistantMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string"
  );
}
