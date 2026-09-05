"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, LogOut, User as UserIcon, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";
import { roleLabel } from "@/lib/permissions";
import type { UserRole } from "@/types/database";
import { logoutAction } from "@/app/login/actions";

export function Header({
  fullName,
  role,
  onOpenMobileMenu,
  canSearchStudents,
}: {
  fullName: string;
  role: UserRole;
  onOpenMobileMenu: () => void;
  canSearchStudents: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/students?search=${encodeURIComponent(query.trim())}`);
    }
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

      {/* Single flexible region for the search bar (or empty space when
          search isn't available) — avoids two competing flex-1 elements
          that used to cramp the input on narrow phone screens. */}
      <div className="flex-1 min-w-0">
        {canSearchStudents && (
          <form onSubmit={handleSearch} className="max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students…"
                className="pl-9 h-9"
                aria-label="Search students, parents, phone number, or student ID"
              />
            </div>
          </form>
        )}
      </div>

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
