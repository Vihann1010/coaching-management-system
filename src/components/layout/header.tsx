"use client";

import { useEffect, useState } from "react";
import { Menu, LogOut, User as UserIcon, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/types/database";
import { logoutAction } from "@/app/login/actions";

export function Header({
  fullName,
  role,
  onOpenMobileMenu,
}: {
  fullName: string;
  role: UserRole;
  onOpenMobileMenu: () => void;
}) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const shouldUseDark = savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", shouldUseDark);
    const frame = window.requestAnimationFrame(() => setDarkMode(shouldUseDark));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const nextDarkMode = !darkMode;
    document.documentElement.classList.toggle("dark", nextDarkMode);
    window.localStorage.setItem("theme", nextDarkMode ? "dark" : "light");
    setDarkMode(nextDarkMode);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <button
        onClick={onOpenMobileMenu}
        className="lg:hidden text-foreground/70 hover:text-foreground cursor-pointer shrink-0"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleTheme}
        className="flex size-9 items-center justify-center rounded-md text-foreground/70 hover:bg-muted hover:text-foreground cursor-pointer shrink-0"
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-md p-1.5 pr-2.5 hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0">
          <Avatar>
            <AvatarFallback>{initials(fullName)}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium leading-tight">{fullName}</p>
            <p className="text-xs text-muted-foreground leading-tight">{roleLabel(role)}</p>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <UserIcon className="size-3.5" /> {fullName}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => logoutAction()}>
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
