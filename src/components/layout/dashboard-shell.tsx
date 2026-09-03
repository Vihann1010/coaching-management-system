"use client";

import { useState } from "react";
import { Sidebar, type SidebarNavItem } from "./sidebar";
import { Header } from "./header";
import { RealtimeRevalidator } from "@/components/shared/realtime-revalidator";
import type { UserRole } from "@/types/database";

export function DashboardShell({
  coachingName,
  logoSrc,
  navItems,
  fullName,
  role,
  canSearchStudents,
  children,
}: {
  coachingName: string;
  logoSrc: string | null;
  navItems: SidebarNavItem[];
  fullName: string;
  role: UserRole;
  canSearchStudents: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <RealtimeRevalidator />
      <Sidebar
        coachingName={coachingName}
        logoSrc={logoSrc}
        items={navItems}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          fullName={fullName}
          role={role}
          onOpenMobileMenu={() => setMobileOpen(true)}
          canSearchStudents={canSearchStudents}
        />
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
