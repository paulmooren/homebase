"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Toast as BaseToast } from "@base-ui/react/toast";

/** How long a toast stays up unless the page says otherwise. */
const DEFAULT_DURATION_MS = 15_000;

type ToastData = { actions: ReactNode };

// One manager for the whole app, created outside React: the `Toast` component below adds and updates toasts
// through it without subscribing to the list, so updating a toast never re-renders (and re-updates) the component.
const manager = BaseToast.createToastManager<ToastData>();

/**
 * Mount once, around the app: it holds Base UI's toast manager and draws the
 * toasts in a live region at the bottom of the screen, so a screen reader
 * announces each one that appears.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <BaseToast.Provider toastManager={manager} timeout={DEFAULT_DURATION_MS}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className="fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3 outline-none md:bottom-6">
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}

function ToastList() {
  const { toasts } = BaseToast.useToastManager<ToastData>();
  return toasts.map((toast) => (
    <BaseToast.Root
      key={toast.id}
      toast={toast}
      className="flex flex-col gap-3 rounded-2xl bg-text p-4 text-bg shadow-2xl outline-none"
    >
      <BaseToast.Content>
        <BaseToast.Description render={<div />} className="text-[13.5px]">
          {toast.description}
        </BaseToast.Description>
      </BaseToast.Content>
      <div className="flex gap-2">{toast.data?.actions}</div>
    </BaseToast.Root>
  ));
}

/**
 * The dark card at the bottom of the screen that confirms something or offers
 * a follow-up. It is shown for as long as this component is rendered and
 * closes itself after `durationMs` (or when dismissed), calling `onClose` so
 * the page can stop rendering it.
 */
export function Toast({
  children,
  actions,
  onClose,
  durationMs = DEFAULT_DURATION_MS,
}: {
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  durationMs?: number;
}) {
  const id = useRef<string | null>(null);
  const latest = useRef({ children, actions, onClose });

  useEffect(() => {
    latest.current = { children, actions, onClose };
    // The page re-renders this with fresh content (a button disabled while saving): keep the toast in step.
    if (id.current) manager.update(id.current, { description: children, data: { actions } });
  });

  useEffect(() => {
    // Closing because this component unmounted is not the user dismissing it: don't tell the page.
    let unmounted = false;
    const toastId = manager.add({
      description: latest.current.children,
      data: { actions: latest.current.actions },
      timeout: durationMs,
      onClose: () => {
        if (!unmounted) latest.current.onClose();
      },
    });
    id.current = toastId;
    return () => {
      unmounted = true;
      id.current = null;
      manager.close(toastId);
    };
    // Shown once per mount; its content is kept current by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** Primary (light) and secondary (outlined) buttons for a Toast's `actions`. */
export const toastPrimary =
  "flex-1 rounded-xl bg-bg px-4 py-2.5 text-center text-[13.5px] font-semibold text-text hover:opacity-90";
export const toastSecondary =
  "rounded-xl border border-white/25 px-4 py-2.5 text-center text-[13.5px] font-medium hover:bg-white/10";
