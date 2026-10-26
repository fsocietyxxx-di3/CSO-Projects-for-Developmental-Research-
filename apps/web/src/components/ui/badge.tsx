import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type * as React from "react";

/**
 * Status flag system — Workflow v4. Every status/flag in the app renders
 * through this one component (Nielsen: consistency & standards).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        neutral: "border-stone-300 bg-stone-100 text-stone-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border-amber-300 bg-amber-50 text-amber-800",
        danger: "border-red-200 bg-red-50 text-red-800",
        info: "border-sky-200 bg-sky-50 text-sky-800",
        gold: "border-gold-500/40 bg-gold-100 text-gold-700",
        navy: "border-gov-900 bg-gov-800 text-white",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ variant, className, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Status color mapping used across records (single source of truth). */
export const statusBadgeVariant: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  PENDING: "warning",
  CLEARED: "neutral",
  GOOD_STANDING: "success",
  WITH_CASES: "danger",
  PENDING_CLEARANCE: "warning",
  PENDING_ACCREDITATION: "warning",
  ACCREDITED: "success",
  RENEWAL_DUE: "warning",
  LAPSED: "danger",
  exact: "danger",
  soft: "warning",
};
