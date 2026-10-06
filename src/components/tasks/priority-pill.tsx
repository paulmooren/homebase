"use client";

import { MenuItem, PopoverMenu } from "@/components/popover-menu";
import type { TaskPriority } from "@/components/tasks/task-row";

export const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: "HIGH", label: "High", dot: "#e5484d" },
  { value: "MEDIUM", label: "Medium", dot: "#e0b04d" },
  { value: "LOW", label: "Low", dot: "#9a9da5" },
];

export const PRIORITY_ORDER: Record<TaskPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Low / Medium / High as a small coloured pill; click it to pick another. */
export function PriorityPill({
  value,
  onChange,
  muted,
}: {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  muted?: boolean;
}) {
  const current = PRIORITIES.find((p) => p.value === value)!;
  return (
    <PopoverMenu
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`Priority: ${current.label}, click to change`}
          className={`inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-border-soft ${
            muted ? "text-text-faint" : "text-text-muted"
          }`}
        >
          <span className="block h-2 w-2 rounded-full" style={{ background: current.dot }} />
          {current.label}
        </button>
      )}
    >
      {({ close }) =>
        PRIORITIES.map((p) => (
          <MenuItem
            key={p.value}
            active={p.value === value}
            onClick={() => {
              onChange(p.value);
              close();
            }}
          >
            <span className="block h-2 w-2 rounded-full" style={{ background: p.dot }} />
            {p.label}
          </MenuItem>
        ))
      }
    </PopoverMenu>
  );
}
