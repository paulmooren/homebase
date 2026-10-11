"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Select } from "@base-ui/react/select";
import { ChevronDownIcon } from "@/components/action-icons";

/** One choice in a dropdown. Values are strings so they round-trip through forms. */
export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

/** What `onChange` receives: just enough of a native change event for `e.target.value`. */
export type SelectChangeEvent = { target: { value: string; name: string } };

/** Reads `<option value>` children (also inside fragments or arrays) into an options list. */
export function optionsFromChildren(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === Fragment) {
      options.push(...optionsFromChildren(props.children));
    } else if (child.type === "option") {
      const label = props.children;
      options.push({
        value: String(props.value ?? (typeof label === "string" ? label : "")),
        label,
        disabled: props.disabled,
      });
    }
  });
  return options;
}

/**
 * The shared dropdown card: opens under the trigger, at least as wide as it,
 * rows styled like the app's other small menus.
 */
export function SelectPopup({ options }: { options: SelectOption[] }) {
  return (
    <Select.Portal>
      <Select.Positioner
        alignItemWithTrigger={false}
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="z-50 outline-none"
      >
        <Select.Popup className="min-w-[max(var(--anchor-width),9rem)] origin-(--transform-origin) overflow-hidden rounded-xl border border-border-soft bg-surface shadow-xl outline-none transition duration-100 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <Select.List className="max-h-(--available-height) overflow-y-auto py-1">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="cursor-default px-3.5 py-2 text-[13.5px] outline-none select-none data-disabled:opacity-40 data-highlighted:bg-surface-hover data-selected:font-medium"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  );
}

type RootProps = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
};

/** Base UI Select.Root wired for string options. Uncontrolled starts on the first option, like a native select. */
function SelectRoot({
  options,
  value,
  defaultValue,
  onValueChange,
  children,
  ...rest
}: RootProps & { children: ReactNode }) {
  return (
    <Select.Root
      items={options}
      value={value}
      defaultValue={defaultValue ?? options[0]?.value ?? ""}
      onValueChange={(v) => onValueChange?.(v ?? "")}
      {...rest}
    >
      {children}
    </Select.Root>
  );
}

/**
 * A dropdown that looks like a text field: full-width trigger carrying `className`
 * (pass the field's classes), our chevron on the right.
 */
export function SelectField({
  className = "",
  wrapperClassName = "",
  "aria-label": ariaLabel,
  autoFocus,
  ...root
}: RootProps & {
  /** Classes for the trigger button. */
  className?: string;
  /** Extra classes for the wrapper around the trigger (e.g. `flex-1`). */
  wrapperClassName?: string;
  "aria-label"?: string;
  autoFocus?: boolean;
}) {
  return (
    <span className={`relative block ${wrapperClassName}`}>
      <SelectRoot {...root}>
        <Select.Trigger
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className={`block w-full cursor-pointer pr-10 text-left data-popup-open:border-accent data-disabled:cursor-default data-disabled:bg-surface-2 data-disabled:text-text-muted ${className}`}
        >
          <Select.Value className="block truncate" />
          <Select.Icon
            className="pointer-events-none absolute top-1/2 right-3.5 block h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          >
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <SelectPopup options={root.options} />
      </SelectRoot>
    </span>
  );
}

/**
 * A small muted dropdown whose trigger is exactly as wide as the chosen value
 * plus a chevron (never as wide as the longest option).
 */
export function InlineSelect({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  "aria-label"?: string;
}) {
  return (
    <SelectRoot options={options} value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className="inline-flex cursor-pointer items-center gap-0.5 text-text-muted transition-colors outline-none hover:text-text focus-visible:text-text data-popup-open:text-text"
      >
        <Select.Value />
        <Select.Icon className="block h-3 w-3">
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <SelectPopup options={options} />
    </SelectRoot>
  );
}
