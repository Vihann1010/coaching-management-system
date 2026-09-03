"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  updateUserRoleAction, toggleUserActiveAction, setTeacherBatchesAction, setStaffPermissionsAction,
} from "@/app/(dashboard)/users/actions";
import type { Batch, PermissionModule, Profile, UserRole } from "@/types/database";

const STAFF_MODULES: PermissionModule[] = ["students", "fees", "attendance", "tests", "batches", "reports"];
const MODULE_LABEL: Record<PermissionModule, string> = {
  students: "Students", fees: "Fees", attendance: "Attendance", tests: "Tests",
  batches: "Batches", reports: "Reports", users: "Users", settings: "Settings", audit_logs: "Audit Logs",
};

export function EditUserDialog({
  user,
  batches,
  currentTeacherBatchIds,
  currentPermissions,
  isSelf,
}: {
  user: Profile;
  batches: Pick<Batch, "id" | "name">[];
  currentTeacherBatchIds: string[];
  currentPermissions: Record<string, { can_view: boolean; can_edit: boolean }>;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [teacherBatchIds, setTeacherBatchIds] = useState<string[]>(currentTeacherBatchIds);
  const [permissions, setPermissions] = useState(() =>
    Object.fromEntries(
      STAFF_MODULES.map((m) => [m, { can_view: currentPermissions[m]?.can_view ?? false, can_edit: currentPermissions[m]?.can_edit ?? false }])
    ) as Record<PermissionModule, { can_view: boolean; can_edit: boolean }>
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const results = await Promise.all([
        role !== user.role ? updateUserRoleAction(user.id, role) : Promise.resolve({}),
        isActive !== user.is_active && !isSelf ? toggleUserActiveAction(user.id, isActive) : Promise.resolve({}),
        role === "teacher" ? setTeacherBatchesAction(user.id, teacherBatchIds) : Promise.resolve({}),
        role === "staff" ? setStaffPermissionsAction(user.id, permissions) : Promise.resolve({}),
      ]);
      const failed = results.find((r) => "error" in r && r.error);
      if (failed && "error" in failed) {
        toast.error(failed.error as string);
      } else {
        toast.success(`${user.full_name} updated`);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8"><Settings2 className="size-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{user.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)} disabled={isSelf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin / Owner</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="active-switch">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive users can&apos;t sign in.</p>
            </div>
            <Switch id="active-switch" checked={isActive} onCheckedChange={setIsActive} disabled={isSelf} />
          </div>

          {role === "teacher" && (
            <div className="space-y-2">
              <Label>Assigned batches</Label>
              <div className="rounded-md border border-border p-3 space-y-2 max-h-48 overflow-y-auto">
                {batches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={teacherBatchIds.includes(b.id)}
                      onCheckedChange={(checked) =>
                        setTeacherBatchIds((prev) => (checked === true ? [...prev, b.id] : prev.filter((id) => id !== b.id)))
                      }
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {role === "staff" && (
            <div className="space-y-2">
              <Label>Module permissions</Label>
              <div className="rounded-md border border-border divide-y divide-border">
                {STAFF_MODULES.map((m) => (
                  <div key={m} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{MODULE_LABEL[m]}</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={permissions[m].can_view}
                          onCheckedChange={(checked) =>
                            setPermissions((prev) => ({ ...prev, [m]: { ...prev[m], can_view: checked === true, can_edit: checked === true ? prev[m].can_edit : false } }))
                          }
                        />
                        <span className="text-xs text-muted-foreground">View</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Checkbox
                          checked={permissions[m].can_edit}
                          disabled={!permissions[m].can_view}
                          onCheckedChange={(checked) => setPermissions((prev) => ({ ...prev, [m]: { ...prev[m], can_edit: checked === true } }))}
                        />
                        <span className="text-xs text-muted-foreground">Edit</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={isPending}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
