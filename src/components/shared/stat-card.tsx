import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
  hint,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "brand" | "success" | "warning" | "danger" | "info";
  hint?: string;
  className?: string;
}) {
  const accentColor = {
    brand: "var(--brand-600)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
  }[accent];

  return (
    <Card className={cn("relative overflow-hidden p-4 pl-5", className)}>
      <span
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: accentColor }}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="tabular-nums font-[family-name:var(--font-display)] text-2xl font-bold mt-1.5 text-foreground">
            {value}
          </p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 12%, white)`, color: accentColor }}
        >
          <Icon className="size-4.5" />
        </div>
      </div>
    </Card>
  );
}
