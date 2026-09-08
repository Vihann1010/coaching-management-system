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
        title="Trippy — Your AI Staff"
        description="Ask plain questions about students, attendance, fees, or test marks — answers come straight from live data. It can also record fees, attendance, and marks, but only after you confirm."
      />
      <AssistantChat adminName={ctx.profile.full_name} initialMessages={initialMessages} canEdit />
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
