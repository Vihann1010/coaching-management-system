"use server";
import type { ZodError } from "zod";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { inviteUserSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";
import type { PermissionModule, UserRole } from "@/types/database";

export interface UserActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

/**
 * Invites a new team member by email using Supabase Auth's admin invite
 * flow (sends them a sign-in link — no admin ever has to see or set a
 * password for someone else). Requires SUPABASE_SERVICE_ROLE_KEY, and
 * that your Supabase project has an email provider configured (works
 * out of the box on Supabase's own SMTP for low volume — see README).
 */
export async function inviteUserAction(_prev: UserActionState, formData: FormData): Promise<UserActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = inviteUserSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  // Only an admin may reach this — enforced again here since this is a
  // privileged, service-role operation, not just relying on the page gate.
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  const { data: actingProfile } = await supabase.from("profiles").select("role").eq("id", userRes.user?.id ?? "").single();
  if (actingProfile?.role !== "admin") {
    return { error: "Only an admin can invite team members." };
  }

  const admin = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name, role: parsed.data.role },
    // Without this, Supabase falls back to whatever "Site URL" is set to
    // in the dashboard (Authentication -> URL Configuration) -- easy to
    // forget when moving from localhost to a real deployment, so we set
    // it explicitly from the same env var the app itself runs at.
    redirectTo: siteUrl ? `${siteUrl}/login` : undefined,
  });

  if (error) {
    return { error: error.message.includes("already registered") ? "That email is already registered." : "Couldn't send the invite. Check your Supabase email settings." };
  }

  // handle_new_user() already created the profile row with the right
  // role from raw_user_meta_data — just make sure phone is saved too.
  if (parsed.data.phone && data.user) {
    await admin.from("profiles").update({ phone: parsed.data.phone }).eq("id", data.user.id);
  }

  revalidatePath("/users");
  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: UserRole) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/users");
  return { error: error ? "Couldn't update role." : undefined };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/users");
  return { error: error ? "Couldn't update status." : undefined };
}

export async function setTeacherBatchesAction(userId: string, batchIds: string[]) {
  const supabase = await createClient();
  await supabase.from("teacher_batches").delete().eq("profile_id", userId);
  if (batchIds.length) {
    const { error } = await supabase
      .from("teacher_batches")
      .insert(batchIds.map((batch_id) => ({ profile_id: userId, batch_id })));
    if (error) return { error: "Couldn't update batch assignments." };
  }
  revalidatePath("/users");
  return {};
}

export async function setStaffPermissionsAction(
  userId: string,
  permissions: Record<PermissionModule, { can_view: boolean; can_edit: boolean }>
) {
  const supabase = await createClient();
  const rows = Object.entries(permissions).map(([module, p]) => ({
    profile_id: userId, module, can_view: p.can_view, can_edit: p.can_edit,
  }));
  const { error } = await supabase.from("user_permissions").upsert(rows, { onConflict: "profile_id,module" });
  revalidatePath("/users");
  return { error: error ? "Couldn't update permissions." : undefined };
}

function flatten(error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
