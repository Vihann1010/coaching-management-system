"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WATCHED_TABLES = ["students", "payments", "attendance", "tests", "test_marks", "batches"] as const;

/**
 * Mounted once in the dashboard layout. Subscribes to Postgres change
 * events (via Supabase Realtime) on the core business tables and
 * refreshes the current route when something changes elsewhere.
 *
 * This is what makes spec section 23 true in practice: if the
 * accountant records a ₹10,000 payment on one laptop, the owner's
 * dashboard on another laptop updates within a second or two, without
 * anyone refreshing the page. Row Level Security still applies to the
 * change events themselves — a device only gets notified about rows it
 * would be allowed to read.
 *
 * Debounced so a bulk operation (e.g. saving attendance for 40
 * students) triggers one refresh, not forty.
 */
export function RealtimeRevalidator() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("coaching-cms-changes");

    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => router.refresh(), 400);
        }
      );
    }

    channel.subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router is
    // stable across the app's lifetime; re-subscribing on every router
    // identity change would be wasteful and isn't needed here.
  }, []);

  return null;
}
