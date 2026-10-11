"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";

import { Button } from "@base-ui/react/button";
/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <BaseSwitch.Root
      checked={checked}
      onCheckedChange={(next) => onChange(next)}
      disabled={disabled}
      aria-label={label}
      nativeButton
      render={<Button type="button" />}
      className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-checked:bg-accent-fill data-disabled:opacity-60"
    >
      <BaseSwitch.Thumb className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform data-checked:translate-x-5" />
    </BaseSwitch.Root>
  );
}
