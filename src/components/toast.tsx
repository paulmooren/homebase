"use client";

import { useEffect } from "react";

/**
 * The dark card that slides in at the bottom of the screen to confirm
 * something or offer a follow-up. It closes itself after `durationMs`.
 */
export function Toast({
  children,
  actions,
  onClose,
  durationMs = 15_000,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3 rounded-2xl bg-text p-4 text-bg shadow-2xl md:bottom-6"
    >
      <div className="text-[13.5px]">{children}</div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

/** Primary (light) and secondary (outlined) buttons for a Toast's `actions`. */
export const toastPrimary =
  "flex-1 rounded-xl bg-bg px-4 py-2.5 text-center text-[13.5px] font-semibold text-text hover:opacity-90";
export const toastSecondary =
  "rounded-xl border border-white/25 px-4 py-2.5 text-center text-[13.5px] font-medium hover:bg-white/10";
