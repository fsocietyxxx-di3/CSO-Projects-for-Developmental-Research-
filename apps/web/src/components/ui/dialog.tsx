import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Application dialog — bottom sheet on mobile (thumb-reach), centered modal
 * on desktop. Installing ironclad confirmations for irreversible actions.
 */
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

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-gov-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute flex flex-col bg-white shadow-2xl outline-none",
          // mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl",
          // desktop: centered modal
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg",
        )}
      >
        <div className={cn("flex items-start justify-between gap-4 border-b px-5 py-4", destructive ? "border-red-100 bg-red-50/60" : "border-stone-200")}>
          <div>
            <h2 className="text-base font-semibold leading-snug">{title}</h2>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
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
