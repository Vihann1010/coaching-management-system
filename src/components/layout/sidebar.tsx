"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Wallet, CalendarCheck, ClipboardList,
  Layers, BarChart3, UserCog, History, Settings, X, AudioWaveform,
} from "lucide-react";
import { LogoWithName } from "@/components/shared/logo";
import { cn } from "@/lib/utils";
import type { PermissionModule } from "@/types/database";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/assistant": AudioWaveform,
  "/students": Users,
  "/fees": Wallet,
  "/attendance": CalendarCheck,
  "/tests": ClipboardList,
  "/batches": Layers,
  "/reports": BarChart3,
  "/users": UserCog,
  "/audit-logs": History,
  "/settings": Settings,
};

export interface SidebarNavItem {
  label: string;
  href: string;
  module: PermissionModule | "dashboard";
}

export function Sidebar({
  coachingName,
  logoSrc,
  items,
  mobileOpen,
  onCloseMobile,
}: {
  coachingName: string;
  logoSrc: string | null;
  items: SidebarNavItem[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();

  const content = (
    <div className="flex h-full flex-col bg-[var(--brand-900)] text-white">
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
        <div className="[&_span]:text-white [&_span]:font-[family-name:var(--font-display)]">
          <LogoWithName name={coachingName} size={28} src={logoSrc} />
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden text-white/70 hover:text-white cursor-pointer"
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {items.map((item) => {
          const Icon = ICONS[item.href] ?? LayoutDashboard;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4.5 shrink-0" />
              {item.href === "/assistant" ? "Trippy-Your Ai Staff" : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-xs text-white/40">
        Coaching Management System
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-72 shadow-xl">{content}</div>
        </div>
      )}
    </>
  );
}
