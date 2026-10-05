"use client";

import { useEffect, useRef, useState } from "react";

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative flex self-stretch ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="flex w-3 cursor-pointer justify-center self-stretch"
      >
        <span className="block w-[3px] rounded-full" style={{ background: value }} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Pick a colour"
          className="absolute top-full left-0 z-20 mt-2 grid w-max grid-cols-10 gap-1.5 rounded-xl border border-border-soft bg-surface p-3 shadow-lg"
        >
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="option"
              aria-selected={color === value}
              aria-label={color}
              onClick={() => {
                onChange(color);
                setOpen(false);
              }}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                color.toLowerCase() === value.toLowerCase() ? "ring-2 ring-text ring-offset-2 ring-offset-surface" : ""
              }`}
              style={{ background: color }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
