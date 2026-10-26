import { cn } from "@/lib/utils";

/**
 * Sticky form action bar — pins to the viewport bottom on phones (thumb
 * reach, safe-area aware) and becomes a normal right-aligned row on desktop.
 * Children receive flex-1 on mobile for full-width taps.
 */
export function FormActionBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-2 flex gap-2 border-t border-stone-200 bg-background/90 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] backdrop-blur",
        "sm:static sm:mx-0 sm:mt-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        "[&>*]:flex-1 [&>*]:sm:flex-none [&>*]:sm:justify-self-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
