"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The id of the spot to the right of the page title that the app shell provides. */
export const PAGE_ACTIONS_ID = "page-actions";

/**
 * Puts a page's main actions ("+ Transaction", "+ New entry"…) next to the
 * page title in the app shell, wherever the page itself is rendered.
 */
export function PageActions({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Looked up after mount: the shell's slot only exists on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(document.getElementById(PAGE_ACTIONS_ID));
  }, []);
  return target ? createPortal(children, target) : null;
}
