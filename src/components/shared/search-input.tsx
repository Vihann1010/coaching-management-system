"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Debounced search box — keeps typing snappy even while the parent
    re-queries Supabase on every change (spec section 6: "search should
    work quickly even with 500+ students"). */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [local, setLocal] = useState(value);

  // Syncs the local edit buffer when the parent's URL-driven `value`
  // prop changes externally (e.g. "Clear filters"). There's no
  // render-time equivalent here since `local` is deliberately decoupled
  // from parent re-renders while the person is actively typing.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8"
        aria-label={placeholder}
      />
      {local && (
        <button
          type="button"
          onClick={() => setLocal("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
