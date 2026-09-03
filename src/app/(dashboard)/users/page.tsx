import { UserCog } from "lucide-react";
import { getSessionContext, requireModuleAccess } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";
import { EditUserDialog } from "@/components/users/edit-user-dialog";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";

const ROLE_BADGE: Record<UserRole, "brand" | "success" | "info" | "neutral"> = {
  admin: "brand", accountant: "success", teacher: "info", staff: "neutral",
};

export default async function UsersPage() {
  const ctx = await getSessionContext();
  requireModuleAccess(ctx, "users", "view"); // admin-only module — see NAV_ITEMS / ROLE_DEFAULT_VIEW

  const supabase = await createClient();
  const [{ data: users }, { data: batches }, { data: teacherBatches }, { data: permissions }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("batches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("teacher_batches").select("profile_id, batch_id"),
    supabase.from("user_permissions").select("profile_id, module, can_view, can_edit"),
  ]);

  const teacherBatchMap = new Map<string, string[]>();
  for (const tb of teacherBatches ?? []) {
    teacherBatchMap.set(tb.profile_id, [...(teacherBatchMap.get(tb.profile_id) ?? []), tb.batch_id]);
  }
  const permissionsMap = new Map<string, Record<string, { can_view: boolean; can_edit: boolean }>>();
  for (const p of permissions ?? []) {
    const existing = permissionsMap.get(p.profile_id) ?? {};
    existing[p.module] = { can_view: p.can_view, can_edit: p.can_edit };
    permissionsMap.set(p.profile_id, existing);
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage who can access the system and what they can do."
        actions={<InviteUserDialog />}
      />

      {!users || users.length === 0 ? (
        <EmptyState icon={UserCog} title="No team members yet" action={<InviteUserDialog />} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8"><AvatarFallback className="text-xs">{initials(u.full_name)}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium">{u.full_name}{u.id === ctx.userId && <span className="text-muted-foreground font-normal"> (you)</span>}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant={ROLE_BADGE[u.role as UserRole]}>{roleLabel(u.role as UserRole)}</Badge></TableCell>
                <TableCell><ActiveStatusBadge isActive={u.is_active} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.phone || "—"}</TableCell>
                <TableCell>
                  <EditUserDialog
                    user={u}
                    batches={batches ?? []}
                    currentTeacherBatchIds={teacherBatchMap.get(u.id) ?? []}
                    currentPermissions={permissionsMap.get(u.id) ?? {}}
                    isSelf={u.id === ctx.userId}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
