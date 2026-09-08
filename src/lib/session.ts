import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, PermissionModule } from "@/types/database";
import { canView as checkView, canEdit as checkEdit } from "@/lib/permissions";
import { redirect } from "next/navigation";

export interface SessionContext {
  userId: string;
  profile: Profile;
  staffPermissions: Record<string, { can_view: boolean; can_edit: boolean }>;
  teacherBatchIds: string[];
}

/**
 * Loads everything a page needs to know about "who is looking at this
 * screen and what are they allowed to do". Redirects to /login if there
 * is no session, and to a friendly error state if the profile row is
 * missing (should not normally happen — see handle_new_user() trigger).
 */
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login?error=profile_missing");
  }

  if (!profile.is_active) {
    redirect("/login?error=account_disabled");
  }

  const staffPermissions: SessionContext["staffPermissions"] = {};
  let teacherBatchIds: string[] = [];

  if (profile.role === "staff") {
    const { data: perms } = await supabase
      .from("user_permissions")
      .select("module, can_view, can_edit")
      .eq("profile_id", user.id);
    for (const p of perms ?? []) {
      staffPermissions[p.module] = { can_view: p.can_view, can_edit: p.can_edit };
    }
  }

  if (profile.role === "teacher") {
    const { data: tb } = await supabase
      .from("teacher_batches")
      .select("batch_id")
      .eq("profile_id", user.id);
    teacherBatchIds = (tb ?? []).map((t) => t.batch_id);
  }

  return { userId: user.id, profile: profile as Profile, staffPermissions, teacherBatchIds };
});

/** Redirects home with a "not authorized" flag if the module check fails. */
export function requireModuleAccess(
  ctx: SessionContext,
  module: PermissionModule,
  need: "view" | "edit" = "view"
) {
  const permCtx = {
    profile: ctx.profile,
    staffPermissions: ctx.staffPermissions,
    teacherBatchIds: ctx.teacherBatchIds,
  };
  const allowed = need === "view" ? checkView(permCtx, module) : checkEdit(permCtx, module);
  if (!allowed) {
    redirect("/dashboard?error=not_authorized");
  }
}
