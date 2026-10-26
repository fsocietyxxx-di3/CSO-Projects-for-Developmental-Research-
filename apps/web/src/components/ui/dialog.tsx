import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useEnterExit } from "@/lib/use-enter-exit";

/**
 * Application dialog — bottom sheet on mobile (thumb-reach), centered modal
 * on desktop. Motion: slide-up 200 ms on phones, fade+scale 150 ms on
 * desktop (charter tokens; `< html` prefers-reduced-motion handled globally).
 */
const MS = { outMs: 150 };

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  destructive,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  destructive?: boolean;
}) {
  const { mounted, shown } = useEnterExit(open, MS.outMs);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-hidden={!shown}
    >
      {/* Scrim — fades */}
      <button
        aria-label="Close dialog"
        tabIndex={shown ? 0 : -1}
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-gov-950/55 backdrop-blur-[2px] transition-opacity",
          shown ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: "var(--motion-out)" }}
      />
      {/* Centering layer — desktop centers via flex (no translate conflicts),
          mobile pins to bottom via justify-end */}
      <div className="pointer-events-none relative flex h-full flex-col justify-end sm:items-center sm:justify-center">
        <div
          className={cn(
            "pointer-events-auto flex max-h-[88dvh] w-full flex-col bg-white shadow-2xl outline-none",
            // mobile: bottom sheet — slides up 200ms
            "rounded-t-xl transition-all",
            // desktop: centered modal — fades/scales 150ms
            "sm:max-h-[85vh] sm:max-w-md sm:rounded-lg",
            shown ? "translate-y-0 sm:scale-100 sm:opacity-100" : "translate-y-full sm:scale-95 sm:opacity-0",
          )}
          style={{ transitionDuration: "var(--motion-in)", transitionTimingFunction: "var(--motion-ease)" }}
        >
          <div
            className={cn(
              "flex items-start justify-between gap-4 border-b px-5 py-4",
              destructive ? "border-red-100 bg-red-50/60" : "border-stone-200",
            )}
          >
            <div>
              <h2 className="text-base font-semibold leading-snug">{title}</h2>
              {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              tabIndex={shown ? 0 : -1}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="size-4" />
            </button>
          </div>
          {children && <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-stone-200 px-5 py-3 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Destructive action button pair for dialog footers. */
export function ConfirmFooter({
  confirmLabel,
  onConfirm,
  disable,
  pending,
  destructive,
  onCancel,
}: {
  confirmLabel: string;
  onConfirm: () => void;
  disable?: boolean;
  pending?: boolean;
  destructive?: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        variant={destructive ? "destructive" : "default"}
        onClick={onConfirm}
        disabled={disable || pending}
      >
        {pending ? "Working…" : confirmLabel}
      </Button>
    </>
  );
}
