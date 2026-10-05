"use client";

import { useEffect } from "react";

/** Small centered overlay asking "are you sure?" — used instead of the browser's confirm(). */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-[20px] bg-surface p-5 shadow-2xl">
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13.5px] text-text-muted">{description}</p>}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-critical px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border-soft px-4 py-3 text-[14px] font-medium text-text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
