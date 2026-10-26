import { useEffect, useState } from "react";

/**
 * Motion charter primitive — turns a boolean `open` into a mounted+shown
 * pair so enter AND exit transitions can play before unmount.
 *
 *   mounted = element is in the DOM (keep during exit animation)
 *   shown   = element is in its final, visible state (drive classes with it)
 *
 * Double-rAF guarantees the browser paints the hidden state once before
 * the transition to `shown` begins.
 */
export function useEnterExit(open: boolean, outMs = 150): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), outMs);
    return () => clearTimeout(t);
  }, [open, outMs]);

  return { mounted, shown };
}
