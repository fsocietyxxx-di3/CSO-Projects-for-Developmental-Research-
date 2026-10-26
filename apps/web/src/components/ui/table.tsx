import { cn } from "@/lib/utils";

/**
 * Government data table primitives — uppercase small header, hairline rows,
 * numerics right-aligned (compose columns yourself).
 * Mobile: pages pair <GovTable…> with a sm:hidden card list.
 */
export function TableShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-stone-200 bg-white shadow-sm overflow-x-auto", className)}>
      {children}
    </div>
  );
}

export function GovTable({ className, children }: { className?: string; children: React.ReactNode }) {
  return <table className={cn("w-full text-sm", className)}>{children}</table>;
}

export function GovTh({ className, right, children }: { className?: string; right?: boolean; children: React.ReactNode }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-stone-200 bg-stone-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function GovTd({ className, right, children }: { className?: string; right?: boolean; children: React.ReactNode }) {
  return (
    <td
      className={cn(
        "border-b border-stone-100 px-4 py-3 align-middle",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TableFoot({ total, pageNote }: { total: number; pageNote?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2 text-[11px] uppercase tracking-wide text-stone-500 last:border-b-0">
      <span>Showing {total} record{total === 1 ? "" : "s"}</span>
      {pageNote && <span className="font-mono lowercase">{pageNote}</span>}
    </div>
  );
}
