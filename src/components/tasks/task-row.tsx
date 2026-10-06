"use client";

import { useState } from "react";

import { InlineEdit } from "@/components/inline-edit";

import { formatDate } from "@/lib/format";
import { RECURRING_FREQUENCY_LABELS, type RecurringFrequency } from "@/lib/constants";
import { TrashIcon, ChevronDownIcon, CheckIcon } from "@/components/action-icons";

export const FREQUENCIES = Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[];

/** Shared text size for a task's title, so it reads at a consistent scale everywhere. */
export const CELL_TEXT = "text-[14px]";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Task = {
  id: string;
  title: string;
  priority: TaskPriority;
  dueDate: string | Date | null;
  frequency: RecurringFrequency | null;
  completedAt: string | Date | null;
  ownerId: string | null;
};

export type Member = { user: { id: string; name: string | null; email: string; image?: string | null } };

export type FormValues = {
  title: string;
  dueDate: Date | null;
  frequency: RecurringFrequency | null;
  ownerId: string | null;
};

/**
 * One task/reminder row — checkbox, editable title, editable due date,
 * editable recurrence, editable assignee, delete. Shared between the Tasks
 * page and the Dashboard's quick view, so editing works identically in both
 * places rather than the dashboard being a read-only, less capable copy.
 */
export function TaskRow({
  task,
  members,
  currentUserId,
  isOverdue,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: Task;
  members: Member[];
  currentUserId: string;
  isOverdue: boolean;
  onToggle: () => void;
  onUpdate: (values: Partial<FormValues>) => void;
  onDelete: () => void;
}) {
  // A reminder (has a frequency) never "finishes" — toggling it just
  // reschedules the due date forward, so it never shows checked/done. That
  // meant clicking it gave no visible confirmation at all (the row looks
  // identical, just with a due date that changed a small font-size away) —
  // `justRescheduled` flashes the checkbox green briefly so the click
  // visibly registers, without implying the reminder is now "complete".
  const isDone = !task.frequency && !!task.completedAt;
  const lastDone = task.frequency && task.completedAt ? formatDate(task.completedAt) : null;
  const [justRescheduled, setJustRescheduled] = useState(false);

  function handleToggle() {
    onToggle();
    if (task.frequency) {
      setJustRescheduled(true);
      setTimeout(() => setJustRescheduled(false), 1500);
    }
  }

  return (
    <div className="flex items-start gap-3 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
      <button
        onClick={handleToggle}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          isDone || justRescheduled
            ? "border-good bg-good text-white"
            : "border-border text-transparent hover:border-good hover:text-good"
        }`}
      >
        <span className="block h-3 w-3">
          <CheckIcon />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <TitleCell title={task.title} isDone={isDone} onCommit={(title) => onUpdate({ title })} />

        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
          <DateCell
            value={task.dueDate}
            isCritical={isOverdue && !isDone}
            onCommit={(dueDate) => onUpdate({ dueDate })}
          />
          {justRescheduled && (
            <span className="font-medium text-good">Rescheduled ✓</span>
          )}
          <span className="text-text-faint">·</span>
          <InlineSelect
            value={task.frequency ?? ""}
            onChange={(v) => onUpdate({ frequency: (v || null) as RecurringFrequency | null })}
            options={[
              { value: "", label: "One-off" },
              ...FREQUENCIES.map((f) => ({ value: f, label: RECURRING_FREQUENCY_LABELS[f] })),
            ]}
          />
          {members.length > 1 && (
            <>
              <span className="text-text-faint">·</span>
              <InlineSelect
                value={task.ownerId ?? ""}
                onChange={(v) => onUpdate({ ownerId: v || null })}
                options={[
                  { value: "", label: "Shared" },
                  ...members.map((m) => ({
                    value: m.user.id,
                    label: m.user.id === currentUserId ? "You" : m.user.name || m.user.email,
                  })),
                ]}
              />
            </>
          )}
          {lastDone && (
            <>
              <span className="text-text-faint">·</span>
              <span className="text-text-faint">Last done {lastDone}</span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        aria-label={`Delete ${task.title}`}
        className="mt-0.5 h-4 w-4 shrink-0 text-text-muted hover:text-critical"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

function TitleCell({
  title,
  isDone,
  onCommit,
}: {
  title: string;
  isDone: boolean;
  onCommit: (title: string) => void;
}) {
  return (
    <InlineEdit
      value={title}
      ariaLabel="Title"
      onCommit={onCommit}
      display={<span className={isDone ? "line-through" : ""}>{title}</span>}
      className={`${CELL_TEXT} font-medium ${isDone ? "text-text-faint" : ""}`}
      buttonClassName="block w-full cursor-pointer truncate text-left"
    />
  );
}

function DateCell({
  value,
  isCritical,
  onCommit,
}: {
  value: string | Date | null;
  isCritical: boolean;
  onCommit: (date: Date | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  // The field takes over exactly the width of the text it replaces, so nothing around it moves.
  const [width, setWidth] = useState<number | undefined>(undefined);
  const isoValue = value ? new Date(value).toISOString().slice(0, 10) : "";

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        // Deliberately uncontrolled (defaultValue, not value+onChange): a
        // native date input manages its own per-segment (day/month/year)
        // typing state internally, and React re-asserting `.value` on every
        // keystroke fights that, causing the field to behave as if a
        // single digit already completed the year. Reading the value once,
        // on blur, sidesteps the conflict entirely.
        defaultValue={isoValue}
        aria-label="Due date"
        style={{ width }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = isoValue;
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => {
          setEditing(false);
          const next = e.target.value;
          if (next !== isoValue) onCommit(next ? new Date(next) : null);
        }}
        className={`m-0 min-w-0 border-0 bg-transparent p-0 text-[12px] outline-none [&::-webkit-calendar-picker-indicator]:hidden ${
          isCritical && value ? "font-medium text-critical" : "text-text-muted"
        }`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        setWidth(e.currentTarget.getBoundingClientRect().width);
        setEditing(true);
      }}
      aria-label={`Due date: ${value ? formatDate(value) : "none"}, click to change`}
      className={`cursor-pointer whitespace-nowrap text-left ${
        isCritical && value ? "font-medium text-critical" : "text-text-muted"
      }`}
    >
      {value ? formatDate(value) : "No due date"}
    </button>
  );
}

/**
 * A native <select> sized to fit its currently selected value, not (as
 * browsers do by default) to its widest option. See recurring/page.tsx for
 * the fuller explanation of the peer-hover/peer-focus trick this reuses.
 */
export function InlineSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const currentLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <span className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface text-text">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none flex items-center gap-0.5 whitespace-nowrap text-text-muted transition-colors peer-focus:text-text">
        {currentLabel}
        <span className="block h-3 w-3 shrink-0">
          <ChevronDownIcon />
        </span>
      </span>
    </span>
  );
}
