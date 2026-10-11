"use client";

import { useRef } from "react";
import { Tooltip } from "@base-ui/react/tooltip";

/**
 * A dark hover tip over any element. Opens on hover and on keyboard focus, so
 * give the child `tabIndex={0}` (and its own accessible name) when it isn't
 * already focusable. The child is the trigger itself, no wrapper element is added.
 *
 * `anchorToChild` places the tip against the trigger's first child instead of
 * the trigger (a tall hover area with a small mark inside it, like a chart bar).
 */
export function Tip({
  label,
  children,
  side = "top",
  align = "center",
  anchorToChild,
  className = "",
}: {
  label: React.ReactNode;
  children: React.ReactElement<Record<string, unknown>>;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  anchorToChild?: boolean;
  /** Extra classes for the tip card, e.g. `text-center`. */
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Tooltip.Provider delay={0} closeDelay={0}>
      <Tooltip.Root disableHoverablePopup>
        <Tooltip.Trigger ref={triggerRef} render={children} />
        <Tooltip.Portal>
          <Tooltip.Positioner
            side={side}
            align={align}
            sideOffset={6}
            collisionPadding={8}
            anchor={anchorToChild ? () => triggerRef.current?.firstElementChild ?? null : undefined}
          >
            <Tooltip.Popup
              className={`pointer-events-none rounded-lg bg-text px-2.5 py-1.5 text-[11.5px] font-medium whitespace-nowrap text-bg shadow-lg ${className}`}
            >
              {label}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
