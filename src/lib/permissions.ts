import type { PermissionModule, Profile, UserRole } from "@/types/database";

/**
 * IMPORTANT: this file only controls what the UI *shows*. It is a UX
 * convenience so non-technical staff don't see buttons they can't use.
 * The actual security boundary is Row Level Security in Postgres
 * (supabase/migrations/0002_rls_policies.sql) — a request blocked there
 * fails no matter what this file says. Keep the two in sync when you
 * change either one.
 */

export interface PermissionContext {
  profile: Pick<Profile, "role"> | null;
  /** module -> {can_view, can_edit}, only populated for role === "staff" */
  staffPermissions?: Record<string, { can_view: boolean; can_edit: boolean }>;
  /** batch ids the current user teaches, only populated for role === "teacher" */
  teacherBatchIds?: string[];
}

const ADMIN_ONLY_MODULES: PermissionModule[] = ["users", "settings", "audit_logs"];

const ROLE_DEFAULT_VIEW: Record<UserRole, PermissionModule[]> = {
  admin: ["students", "fees", "attendance", "tests", "batches", "reports", "users", "settings", "audit_logs"],
  accountant: ["students", "fees", "reports", "batches"],
  teacher: ["students", "attendance", "tests", "batches", "reports"],
  staff: ["batches"], // everything else is opt-in via user_permissions
};

const ROLE_DEFAULT_EDIT: Record<UserRole, PermissionModule[]> = {
  admin: ["students", "fees", "attendance", "tests", "batches", "reports", "users", "settings", "audit_logs"],
  accountant: ["fees", "students"], // students: fee-fields, see README note
  teacher: ["attendance", "tests"],
  staff: [],
};

export function canView(ctx: PermissionContext, module: PermissionModule): boolean {
  const role = ctx.profile?.role;
  if (!role) return false;
  if (role === "admin") return true;
  if (ADMIN_ONLY_MODULES.includes(module)) return false;

  if (ROLE_DEFAULT_VIEW[role].includes(module)) return true;
  if (role === "staff" && ctx.staffPermissions?.[module]?.can_view) return true;
  return false;
}

export function canEdit(ctx: PermissionContext, module: PermissionModule): boolean {
  const role = ctx.profile?.role;
  if (!role) return false;
  if (role === "admin") return true;
  if (ADMIN_ONLY_MODULES.includes(module)) return false;

  if (ROLE_DEFAULT_EDIT[role].includes(module)) return true;
  if (role === "staff" && ctx.staffPermissions?.[module]?.can_edit) return true;
  return false;
}

export function canViewBatch(ctx: PermissionContext, batchId: string | null): boolean {
  const role = ctx.profile?.role;
  if (!role || !batchId) return false;
  if (role === "admin" || role === "accountant") return true;
  if (role === "teacher") return ctx.teacherBatchIds?.includes(batchId) ?? false;
  if (role === "staff") return canView(ctx, "students");
  return false;
}

export const NAV_ITEMS: Array<{ label: string; href: string; module: PermissionModule }> = [
  { label: "Dashboard", href: "/dashboard", module: "reports" },
  { label: "Students", href: "/students", module: "students" },
  { label: "Fees", href: "/fees", module: "fees" },
  { label: "Attendance", href: "/attendance", module: "attendance" },
  { label: "Tests", href: "/tests", module: "tests" },
  { label: "Batches", href: "/batches", module: "batches" },
  { label: "Reports", href: "/reports", module: "reports" },
  { label: "Users", href: "/users", module: "users" },
  { label: "Audit Logs", href: "/audit-logs", module: "audit_logs" },
  { label: "Settings", href: "/settings", module: "settings" },
];

export function roleLabel(role: UserRole): string {
  return { admin: "Admin", accountant: "Accountant", teacher: "Teacher", staff: "Staff" }[role];
}
