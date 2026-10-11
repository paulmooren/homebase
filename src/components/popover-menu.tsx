"use client";

import { useRef, useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";

const PANEL =
  "min-w-[170px] overflow-hidden rounded-xl border border-border-soft bg-surface py-1 shadow-xl outline-none";

// Right-aligned panels line up with the trigger's right edge, left-aligned ones with its left edge.
const ALIGN = { left: "start", right: "end" } as const;

/**
 * A small floating list of choices opened from any trigger: arrow keys move,
 * Escape and an outside click close, and focus returns to the trigger. Picking
 * an item closes it. `trigger` is the button to click (its own props and
 * children are kept); the panel is portalled, so rows that clip their overflow
 * can't cut it off. For a panel with a form in it, use `PopoverPanel`.
 */
export function PopoverMenu({
  trigger,
  children,
  align = "right",
}: {
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align={ALIGN[align]} sideOffset={6} collisionPadding={8} className="outline-none">
          <Menu.Popup className={PANEL}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** One row of a PopoverMenu. Picking it closes the menu. */
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
    <Menu.Item
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] outline-none select-none data-highlighted:bg-surface-hover"
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
      {active && (
        <span className="text-[12px] text-text-muted">
          <span aria-hidden>✓</span>
          <span className="sr-only">(selected)</span>
        </span>
      )}
    </Menu.Item>
  );
}

/**
 * The same floating panel as PopoverMenu, for content that is a form rather
 * than a list of items (typing and Tab must keep working inside it). Escape and
 * an outside click close it; `children` gets a `close` to call once saved.
 */
export function PopoverPanel({
  trigger,
  children,
  align = "right",
}: {
  trigger: React.ReactElement;
  children: (api: { close: () => void }) => React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align={ALIGN[align]} sideOffset={6} collisionPadding={8} className="outline-none">
          <Popover.Popup
            ref={popupRef}
            // First field from the keyboard; the panel itself by pointer or touch, so no field lights up that didn't before.
            initialFocus={(openType) => (openType === "keyboard" ? true : popupRef.current)}
            className={PANEL}
          >
            {children({ close: () => setOpen(false) })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
