import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-stone-200/80", className)} />;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-stone-300">{icon}</div>}
      <h3 className="font-serif text-sm font-semibold text-stone-700">{title}</h3>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Allotment / usage meter — the visual allotment flag (limpok when under,
 * gold when near-full).
 */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-stone-200 overflow-hidden", className)}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${pct >= 90 ? "bg-gold-500" : pct >= 60 ? "bg-gov-600" : "bg-emerald-600"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
