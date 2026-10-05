import type { ReactNode } from "react";

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
