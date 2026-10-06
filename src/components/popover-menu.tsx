"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small floating menu opened from any trigger. Positioned with `fixed` from
 * the trigger's own spot, so rows that clip their overflow can't cut it off;
 * closes on outside click, Escape or scroll. `children` gets a `close` to call
 * once something is picked.
 */
export function PopoverMenu({
  trigger,
  children,
  align = "right",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (api: { close: () => void }) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      setPos(
        align === "right"
          ? { top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) }
          : { top: rect.bottom + 6, left: Math.max(8, rect.left) },
      );
    }
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[data-popover-panel]")) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, align]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && pos && (
        <div
          data-popover-panel
          role="menu"
          style={{ position: "fixed", ...pos }}
          className="z-50 min-w-[170px] overflow-hidden rounded-xl border border-border-soft bg-surface py-1 shadow-xl"
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </span>
  );
}

/** One row of a PopoverMenu. */
export function MenuItem({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] hover:bg-surface-hover"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {active && <span className="text-[12px] text-text-muted">✓</span>}
    </button>
  );
}
