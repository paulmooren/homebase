"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Button } from "@base-ui/react/button";

import { CATEGORY_COLORS } from "@/lib/constants";

/**
 * The category's vertical colour bar (same as in the transaction and
 * recurring rows) doubling as the trigger for a palette popover.
 */
export function ColorBarPicker({
  value,
  onChange,
  label,
  className = "",
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex self-stretch ${className}`}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger aria-label={label} className="flex w-3 cursor-pointer justify-center self-stretch">
          <span className="block w-[3px] rounded-full" style={{ background: value }} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={8} className="outline-none">
            <Popover.Popup
              aria-label="Pick a colour"
              className="grid w-max grid-cols-10 gap-1.5 rounded-xl border border-border-soft bg-surface p-3 shadow-lg outline-none"
            >
              {CATEGORY_COLORS.map((color) => (
                <Button
                  key={color}
                  type="button"
                  aria-pressed={color.toLowerCase() === value.toLowerCase()}
                  aria-label={color}
                  onClick={() => {
                    onChange(color);
                    setOpen(false);
                  }}
                  className={`h-6 w-6 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    color.toLowerCase() === value.toLowerCase() ? "ring-2 ring-text ring-offset-2 ring-offset-surface" : ""
                  }`}
                  style={{ background: color }}
                />
              ))}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
