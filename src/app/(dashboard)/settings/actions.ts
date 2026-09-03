"use server";

import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validations";
import { getSessionContext } from "@/lib/session";
import { revalidatePath } from "next/cache";

export interface SettingsActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

export async function updateSettingsAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const out: Record<string, string> = {};
    for (const issue of parsed.error.issues) out[String(issue.path[0])] = issue.message;
    return { fieldErrors: out };
  }

  const ctx = await getSessionContext();
  if (ctx.profile.role !== "admin") {
    return { error: "Only an admin can change these settings." };
  }

  const supabase = await createClient();

  const logoUrl = String(formData.get("logo_url") || "").trim();

  const rows = [
    { key: "coaching_name", value: parsed.data.coaching_name },
    { key: "contact_email", value: parsed.data.contact_email || "" },
    { key: "contact_phone", value: parsed.data.contact_phone || "" },
    { key: "academic_session", value: parsed.data.academic_session },
    { key: "currency", value: parsed.data.currency },
    { key: "fee_overdue_days", value: parsed.data.fee_overdue_days },
    { key: "logo_url", value: logoUrl || null },
  ].map((r) => ({ key: r.key, value: r.value, updated_by: ctx.userId }));

  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });

  if (error) return { error: `Couldn't save settings: ${error.message}` };

  revalidatePath("/settings");
  revalidatePath("/login");
  revalidatePath("/dashboard");
  return { success: true };
}
