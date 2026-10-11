"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";

/**
 * A tick box. Put it inside a <label> with the text and the whole row toggles.
 * `className` can recolour the checked state (it defaults to the accent fill).
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  className = "data-checked:border-accent-fill data-checked:bg-accent-fill",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onChange(next)}
      disabled={disabled}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-disabled:opacity-60 ${className}`}
    >
      <BaseCheckbox.Indicator className="flex text-accent-ink">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2.5 6.5 5 9l4.5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
