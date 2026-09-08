"use client";

import type { ComponentType } from "react";
import {
  ArrowRight,
  CalendarCheck,
  ClipboardList,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Starter {
  icon: ComponentType<{ className?: string }>;
  label: string;
  query: string;
  tint: string;
}

const STARTERS: Starter[] = [
  {
    icon: CalendarCheck,
    label: "Students present today",
    query: "How many students were present today?",
    tint: "bg-[var(--brand-50)] text-[var(--brand-600)]",
  },
  {
    icon: ClipboardList,
    label: "Priya's test marks",
    query: "What are Priya Sharma's test marks?",
    tint: "bg-[var(--info-bg)] text-[var(--info)]",
  },
  {
    icon: Wallet,
    label: "Add Rs. 5000 to Aarav's fees",
    query: "Aarav ki fees me 5000 add kardo, cash se",
    tint: "bg-[var(--warning-bg)] text-[var(--warning)]",
  },
  {
    icon: TrendingUp,
    label: "Fees collected this week",
    query: "How much fee did we collect this week?",
    tint: "bg-[var(--success-bg)] text-[var(--success)]",
  },
  {
    icon: Users,
    label: "Absentees in Batch A",
    query: "List absent students in Batch A today",
    tint: "bg-[var(--brand-50)] text-[var(--brand-600)]",
  },
  {
    icon: Layers,
    label: "Active batches",
    query: "List all active batches and their students.",
    tint: "bg-[var(--info-bg)] text-[var(--info)]",
  },
];

const CAPABILITIES = ["Students", "Attendance", "Fees", "Test marks", "Batches"];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function ChatEmpty({
  adminName,
  onPick,
  disabled,
}: {
  adminName: string;
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const firstName = adminName.trim().split(/\s+/)[0] || "there";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-8 px-4 py-10 text-center sm:px-6">
        {/* Hero */}
        <div className="space-y-4">
          <div className="relative mx-auto flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-500),var(--brand-800))] text-white shadow-sm ring-4 ring-[var(--brand-100)]">
            <Sparkles className="size-7" />
            <span
              className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--success)] ring-2 ring-card"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--brand-900)] sm:text-2xl">
              {greeting()}, {firstName}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              I&apos;m Trippy, your AI staff assistant. Ask me anything about your coaching data and I&apos;ll
              pull the answer straight from live records.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {CAPABILITIES.map((capability) => (
              <span
                key={capability}
                className="rounded-full bg-[var(--brand-50)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-700)]"
              >
                {capability}
              </span>
            ))}
          </div>
        </div>

        {/* Starter prompts */}
        <div className="w-full">
          <p className="mb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Try asking
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((starter) => (
              <button
                key={starter.query}
                type="button"
                disabled={disabled}
                onClick={() => onPick(starter.query)}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--brand-500)] hover:bg-[var(--brand-50)] hover:shadow-md disabled:pointer-events-none disabled:opacity-50"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", starter.tint)}>
                  <starter.icon className="size-4.5" />
                </span>
                <span className="flex-1 leading-tight">{starter.label}</span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-[var(--brand-600)] group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          It can look things up instantly — and record fees, attendance or marks only after you say yes.
        </p>
      </div>
    </div>
  );
}