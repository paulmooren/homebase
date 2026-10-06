"use client";

import { useState } from "react";

import { CheckIcon, TrashIcon } from "@/components/action-icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineEdit } from "@/components/inline-edit";
import { PopoverMenu } from "@/components/popover-menu";
import { SelectInput } from "@/components/settings/form";
import { AssigneeAvatar } from "@/components/tasks/assignee-avatar";
import type { Member } from "@/components/tasks/types";
import {
  SCHEDULE_UNITS,
  agoLabel,
  describeSchedule,
  dueBucket,
  dueLabel,
  unitLabel,
  type ScheduleMode,
  type ScheduleUnit,
} from "@/lib/schedule";

export type ReminderData = {
  id: string;
  title: string;
  ownerId: string | null;
  intervalCount: number;
  intervalUnit: ScheduleUnit;
  mode: ScheduleMode;
  nextDueDate: Date | string;
  completions: {
    id: string;
    completedAt: Date | string;
    completedBy: { id: string; name: string | null; email: string } | null;
  }[];
};

export type ReminderPatch = {
  title?: string;
  ownerId?: string | null;
  intervalCount?: number;
  intervalUnit?: ScheduleUnit;
  mode?: ScheduleMode;
};

const nameOf = (u: { name: string | null; email: string }, currentUserId: string, id: string) =>
  id === currentUserId ? "you" : u.name || u.email;

/**
 * One Reminder: tick box, a title you can click to rename, when it's next due,
 * who it's for, and under it how often and when it was last done. Click "Every
 * week" to change the schedule; click "last done" to see the last few times.
 * `compact` (the dashboard) drops the history.
 */
export function ReminderRow({
  reminder,
  members,
  currentUserId,
  today,
  compact,
  onTick,
  onUpdate,
  onDelete,
}: {
  reminder: ReminderData;
  members: Member[];
  currentUserId: string;
  today: Date;
  compact?: boolean;
  onTick: () => void;
  onUpdate: (patch: ReminderPatch) => void;
  onDelete: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const due = new Date(reminder.nextDueDate);
  const bucket = dueBucket(due, today);
  const last = reminder.completions[0];

  return (
    <div className="group border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onTick}
          aria-label={`Mark ${reminder.title} as done`}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-border text-transparent transition-colors hover:border-good hover:text-good"
        >
          <span className="block h-3.5 w-3.5">
            <CheckIcon />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <InlineEdit
            value={reminder.title}
            ariaLabel="Reminder"
            onCommit={(title) => onUpdate({ title })}
            className="text-[14px] font-medium"
            buttonClassName="block w-full cursor-pointer truncate text-left"
          />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-text-muted">
            <SchedulePopover reminder={reminder} onUpdate={onUpdate} />
            <span className="text-text-faint">·</span>
            {last ? (
              <button
                type="button"
                onClick={() => !compact && setShowHistory((v) => !v)}
                className={compact ? "cursor-default" : "hover:text-text"}
              >
                last done {agoLabel(new Date(last.completedAt), today)}
                {last.completedBy && ` by ${nameOf(last.completedBy, currentUserId, last.completedBy.id)}`}
              </button>
            ) : (
              <span>not done yet</span>
            )}
          </div>
        </div>

        <span
          className={`mt-0.5 shrink-0 text-[12.5px] font-medium ${
            bucket === "overdue" ? "text-critical" : bucket === "today" ? "text-text" : "text-text-muted"
          }`}
        >
          {dueLabel(due, today)}
        </span>

        {members.length > 1 && (
          <AssigneeAvatar
            ownerId={reminder.ownerId}
            members={members}
            currentUserId={currentUserId}
            onChange={(ownerId) => onUpdate({ ownerId })}
            size={26}
          />
        )}

        {!compact && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${reminder.title}`}
            className="mt-1 h-4 w-4 shrink-0 text-text-faint hover:text-critical"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      {showHistory && reminder.completions.length > 0 && (
        <ul className="mt-2 ml-9 flex flex-col gap-0.5 text-[12px] text-text-muted">
          {reminder.completions.map((c) => (
            <li key={c.id}>
              {new Date(c.completedAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              {c.completedBy && ` · ${c.completedBy.name || c.completedBy.email}`}
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <ConfirmDialog
          title={`Delete "${reminder.title}"?`}
          description="Its history goes with it."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirming(false);
            onDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** "Every week" as a button that opens a small editor: how many, which unit, and what it counts from. */
function SchedulePopover({ reminder, onUpdate }: { reminder: ReminderData; onUpdate: (patch: ReminderPatch) => void }) {
  return (
    <PopoverMenu
      align="left"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`${describeSchedule(reminder.intervalCount, reminder.intervalUnit)}, click to change`}
          className="underline decoration-dotted decoration-text-faint underline-offset-2 hover:text-text"
        >
          {describeSchedule(reminder.intervalCount, reminder.intervalUnit)}
        </button>
      )}
    >
      {({ close }) => (
        <ScheduleForm
          initial={reminder}
          onSave={(patch) => {
            onUpdate(patch);
            close();
          }}
        />
      )}
    </PopoverMenu>
  );
}

/** The few fields that make up a Schedule. Shared by the editor and the "new reminder" row. */
export function ScheduleForm({
  initial,
  onSave,
}: {
  initial: { intervalCount: number; intervalUnit: ScheduleUnit; mode: ScheduleMode };
  onSave: (patch: { intervalCount: number; intervalUnit: ScheduleUnit; mode: ScheduleMode }) => void;
}) {
  const [count, setCount] = useState(String(initial.intervalCount));
  const [unit, setUnit] = useState<ScheduleUnit>(initial.intervalUnit);
  const [mode, setMode] = useState<ScheduleMode>(initial.mode);
  const n = Math.max(1, Math.min(999, parseInt(count, 10) || 1));

  return (
    // A div, not a <form>: this opens from inside the "new reminder" form, and forms can't nest.
    <div
      className="flex w-[260px] flex-col gap-3 p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSave({ intervalCount: n, intervalUnit: unit, mode });
        }
      }}
    >
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-text-muted">Every</span>
        <input
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          aria-label="Number"
          className="w-14 rounded-lg border border-border bg-surface px-2.5 py-2 text-center text-[14px] outline-none focus:border-accent"
        />
        <div className="min-w-0 flex-1">
          <SelectInput value={unit} onChange={(e) => setUnit(e.target.value as ScheduleUnit)} className="py-2 text-[13.5px]">
            {SCHEDULE_UNITS.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u, n)}
              </option>
            ))}
          </SelectInput>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[11.5px] text-text-muted">Count from</span>
        <SelectInput value={mode} onChange={(e) => setMode(e.target.value as ScheduleMode)} className="py-2 text-[13.5px]">
          <option value="FROM_DONE">When it was done</option>
          <option value="FIXED">A fixed rhythm</option>
        </SelectInput>
      </div>
      <button
        type="button"
        onClick={() => onSave({ intervalCount: n, intervalUnit: unit, mode })}
        className="rounded-lg bg-accent-fill px-4 py-2 text-[13px] font-semibold text-accent-ink hover:opacity-90"
      >
        Save
      </button>
    </div>
  );
}
