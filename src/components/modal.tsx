"use client";

import { useEffect } from "react";

/**
 * A dialog over a dimmed page, for forms that deserve the whole focus: a
 * centred card on desktop, a sheet from the bottom on a phone. Escape, the ✕
 * or a click on the dimmed area closes it. The page behind doesn't scroll.
 */
export function Modal({
  title,
  onClose,
  children,
  width = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-surface shadow-2xl sm:rounded-[24px] ${width}`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="font-display text-[20px] font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 pt-3 pb-6">{children}</div>
      </div>
    </div>
  );
}
