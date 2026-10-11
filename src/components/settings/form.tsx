import type { ReactNode } from "react";
import { SelectField, optionsFromChildren, type SelectChangeEvent } from "@/components/ui/select";

export const inputClass =
  "w-full rounded-xl border border-border-soft bg-surface px-3.5 py-3 text-[14px] outline-none transition-colors placeholder:text-text-faint focus:border-accent disabled:bg-surface-2 disabled:text-text-muted";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12.5px] text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Dark when there's something to save, flat grey when there isn't. */
export function UpdateButton({
  disabled,
  children = "Update",
}: {
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="self-start rounded-xl bg-accent-fill px-5 py-2.5 text-[13.5px] font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:bg-surface-2 disabled:text-text-faint disabled:hover:opacity-100"
    >
      {children}
    </button>
  );
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-b border-border-soft py-8 first:pt-2 last:border-b-0">
      <h2 className="text-[18px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

/**
 * A dropdown that matches `inputClass`: same height and border, with our own chevron.
 * Takes `<option value>` children and an `onChange` that gets `e.target.value`, like a native select;
 * the chosen value is submitted in the form under `name`.
 */
export function SelectInput({
  className = "",
  children,
  onChange,
  name,
  ...props
}: {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  onChange?: (e: SelectChangeEvent) => void;
}) {
  return (
    <SelectField
      {...props}
      name={name}
      options={optionsFromChildren(children)}
      onValueChange={(value) => onChange?.({ target: { value, name: name ?? "" } })}
      className={`${inputClass} ${className}`}
    />
  );
}
