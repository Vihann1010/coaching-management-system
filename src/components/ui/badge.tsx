import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold w-fit",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-[var(--success-bg)] text-[var(--success)]",
        warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
        danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
        info: "bg-[var(--info-bg)] text-[var(--info)]",
        brand: "bg-[var(--brand-100)] text-[var(--brand-800)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
