import { getSessionContext } from "@/lib/session";
import { getAppSettings } from "@/lib/settings";
import { getCustomLogoPath } from "@/lib/custom-logo.server";
import { canView } from "@/lib/permissions";
import { NAV_ITEMS } from "@/lib/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  const settings = await getAppSettings();
  const logoSrc = getCustomLogoPath();

  const permCtx = {
    profile: ctx.profile,
    staffPermissions: ctx.staffPermissions,
    teacherBatchIds: ctx.teacherBatchIds,
  };

  const navItems = NAV_ITEMS.filter(
    (item) => item.href === "/dashboard" || canView(permCtx, item.module)
  );

  return (
    <DashboardShell
      coachingName={settings.coaching_name}
      logoSrc={logoSrc}
      navItems={navItems}
      fullName={ctx.profile.full_name}
      role={ctx.profile.role}
      canSearchStudents={canView(permCtx, "students")}
    >
      {children}
    </DashboardShell>
  );
}
