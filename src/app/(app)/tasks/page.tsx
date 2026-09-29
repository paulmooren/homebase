"use client";

import { useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { formatDate } from "@/lib/format";
import { RECURRING_FREQUENCY_LABELS, type RecurringFrequency } from "@/lib/constants";
import { TrashIcon, PlusIcon, CloseIcon, CheckIcon, ChevronDownIcon } from "@/components/action-icons";

const FREQUENCIES = Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[];

/** Shared text size for a task's title, so it reads at a consistent scale everywhere. */
const CELL_TEXT = "text-[14px]";

type Task = {
  id: string;
  title: string;
  dueDate: string | Date | null;
  frequency: RecurringFrequency | null;
  completedAt: string | Date | null;
  ownerId: string | null;
};

type Member = { user: { id: string; name: string | null; email: string } };

type FormValues = {
  title: string;
  dueDate: Date | null;
  frequency: RecurringFrequency | null;
  ownerId: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function TasksPage() {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.task.list.useQuery();
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const invalidate = () => utils.task.list.invalidate();

  const createTask = trpc.task.create.useMutation({ onSuccess: invalidate });
  const updateTask = trpc.task.update.useMutation({ onSuccess: invalidate });
  const toggleComplete = trpc.task.toggleComplete.useMutation({ onSuccess: invalidate });
  const deleteTask = trpc.task.delete.useMutation({ onSuccess: invalidate });

  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";

  const today = startOfToday();
  const all = (tasks ?? []) as Task[];

  // Two lists, split on the one thing that actually distinguishes them: does
  // it repeat. A one-off task's checkbox stays checked once done; a reminder
  // never "finishes" — completing it just rolls the due date forward (see
  // task.ts toggleComplete), so it has no Completed section of its own.
  const adHoc = all.filter((t) => !t.frequency);
  const reminders = all.filter((t) => !!t.frequency);

  const adHocCompleted = adHoc.filter((t) => t.completedAt);
  const adHocActive = adHoc.filter((t) => !t.completedAt);
  const adHocOverdue = adHocActive.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const adHocUpcoming = adHocActive.filter((t) => !(t.dueDate && new Date(t.dueDate) < today));

  const reminderOverdue = reminders.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const reminderUpcoming = reminders.filter((t) => !(t.dueDate && new Date(t.dueDate) < today));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <TaskColumn
        title="Tasks"
        emptyLabel="Nothing here yet — add one below."
        overdue={adHocOverdue}
        upcoming={adHocUpcoming}
        completed={adHocCompleted}
        members={members}
        currentUserId={currentUserId}
        onToggle={(id) => toggleComplete.mutate({ id })}
        onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
        onDelete={(id) => deleteTask.mutate({ id })}
        addRow={(onDone) => (
          <InlineTaskRow
            members={members}
            currentUserId={currentUserId}
            kind="task"
            onSubmit={(values) => createTask.mutate(values, { onSuccess: onDone })}
            onCancel={onDone}
          />
        )}
        addLabel="New task"
      />

      <TaskColumn
        title="Reminders"
        emptyLabel="Nothing recurring yet — add one below."
        overdue={reminderOverdue}
        upcoming={reminderUpcoming}
        completed={[]}
        members={members}
        currentUserId={currentUserId}
        onToggle={(id) => toggleComplete.mutate({ id })}
        onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
        onDelete={(id) => deleteTask.mutate({ id })}
        addRow={(onDone) => (
          <InlineTaskRow
            members={members}
            currentUserId={currentUserId}
            kind="reminder"
            onSubmit={(values) => createTask.mutate(values, { onSuccess: onDone })}
            onCancel={onDone}
          />
        )}
        addLabel="New reminder"
      />
    </div>
  );
}

function TaskColumn({
  title,
  emptyLabel,
  overdue,
  upcoming,
  completed,
  members,
  currentUserId,
  onToggle,
  onUpdate,
  onDelete,
  addRow,
  addLabel,
}: {
  title: string;
  emptyLabel: string;
  overdue: Task[];
  upcoming: Task[];
  completed: Task[];
  members: Member[];
  currentUserId: string;
  onToggle: (id: string) => void;
  onUpdate: (id: string, values: Partial<FormValues>) => void;
  onDelete: (id: string) => void;
  addRow: (onDone: () => void) => React.ReactNode;
  addLabel: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <h1 className="px-6 pt-6 pb-4 text-[15px] font-semibold">{title}</h1>

      {overdue.length === 0 && upcoming.length === 0 && !adding && (
        <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">{emptyLabel}</p>
      )}

      {overdue.length > 0 && (
        <TaskGroup
          title="Overdue"
          titleClass="text-critical"
          tasks={overdue}
          members={members}
          currentUserId={currentUserId}
          isOverdue
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      {upcoming.length > 0 && (
        <TaskGroup
          tasks={upcoming}
          members={members}
          currentUserId={currentUserId}
          isOverdue={false}
          onToggle={onToggle}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      {adding ? (
        addRow(() => setAdding(false))
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-3 border-b border-border-soft px-6 py-3 text-left text-text-faint transition-colors last:border-b-0 hover:text-text"
        >
          <span className="block h-2.5 w-2.5 shrink-0">
            <PlusIcon />
          </span>
          <span className={CELL_TEXT}>{addLabel}</span>
        </button>
      )}

      {completed.length > 0 && (
        <div className="border-t border-border-soft">
          <TaskGroup
            title="Completed"
            tasks={completed}
            members={members}
            currentUserId={currentUserId}
            isOverdue={false}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      )}
    </section>
  );
}

function TaskGroup({
  title,
  titleClass,
  tasks,
  members,
  currentUserId,
  isOverdue,
  onToggle,
  onUpdate,
  onDelete,
}: {
  title?: string;
  titleClass?: string;
  tasks: Task[];
  members: Member[];
  currentUserId: string;
  isOverdue: boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, values: Partial<FormValues>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      {title && (
        <div
          className={`px-6 pt-3 pb-1 text-[10.5px] font-semibold tracking-[0.09em] uppercase ${titleClass ?? "text-text-faint"}`}
        >
          {title}
        </div>
      )}
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          members={members}
          currentUserId={currentUserId}
          isOverdue={isOverdue}
          onToggle={() => onToggle(task.id)}
          onUpdate={(values) => onUpdate(task.id, values)}
          onDelete={() => onDelete(task.id)}
        />
      ))}
    </>
  );
}

function TaskRow({
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
  // reschedules the due date forward, so it never shows checked/done.
  const isDone = !task.frequency && !!task.completedAt;
  const lastDone = task.frequency && task.completedAt ? formatDate(task.completedAt) : null;

  return (
    <div className="flex items-start gap-3 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
      <button
        onClick={onToggle}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          isDone
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const cancelledRef = useRef(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelledRef.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={() => {
          setEditing(false);
          if (cancelledRef.current) {
            cancelledRef.current = false;
            return;
          }
          const trimmed = draft.trim();
          if (trimmed && trimmed !== title) onCommit(trimmed);
        }}
        className={`w-full rounded-md border border-accent bg-surface px-1.5 -mx-1.5 py-0.5 -my-0.5 ${CELL_TEXT} font-medium text-text outline-none`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(title);
        cancelledRef.current = false;
        setEditing(true);
      }}
      className={`block w-full cursor-pointer truncate text-left ${CELL_TEXT} font-medium ${
        isDone ? "text-text-faint line-through" : ""
      }`}
    >
      {title}
    </button>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const isoValue = value ? new Date(value).toISOString().slice(0, 10) : "";

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="date"
        // Deliberately uncontrolled (defaultValue, not value+onChange): a
        // native date input manages its own per-segment (day/month/year)
        // typing state internally, and React re-asserting `.value` on every
        // keystroke fights that, causing the field to behave as if a
        // single digit already completed the year. Reading the value once,
        // on blur, sidesteps the conflict entirely.
        defaultValue={isoValue}
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
        className="w-[130px] rounded-md border border-accent bg-surface px-1.5 py-0.5 text-[12px] text-text outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`cursor-pointer whitespace-nowrap text-left ${
        isCritical && value ? "font-medium text-critical" : "text-text-muted"
      }`}
    >
      {value ? formatDate(value) : "No due date"}
    </button>
  );
}

function InlineTaskRow({
  members,
  currentUserId,
  kind,
  onSubmit,
  onCancel,
}: {
  members: Member[];
  currentUserId: string;
  kind: "task" | "reminder";
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const [frequency, setFrequency] = useState<RecurringFrequency>("YEARLY");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const multiMember = members.length > 1;

  return (
    <form
      className="flex flex-col gap-2 border-b border-border-soft bg-surface px-6 py-3 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const dueDateRaw = String(form.get("dueDate") || "");
        onSubmit({
          title: String(form.get("title")),
          dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
          frequency: kind === "reminder" ? frequency : null,
          ownerId: multiMember ? ownerId || null : currentUserId,
        });
      }}
    >
      <input
        name="title"
        required
        autoFocus
        placeholder={kind === "reminder" ? "Reminder title" : "Task title"}
        className={`w-full bg-transparent ${CELL_TEXT} font-medium outline-none placeholder:text-text-faint`}
      />
      <div className="flex flex-wrap items-center gap-2.5 text-[12px]">
        <input
          name="dueDate"
          type="date"
          required={kind === "reminder"}
          className="w-[142px] rounded-md border border-border bg-surface px-2 py-1 text-text outline-none focus:border-accent"
        />
        {kind === "reminder" && (
          <InlineSelect
            value={frequency}
            onChange={(v) => setFrequency(v as RecurringFrequency)}
            options={FREQUENCIES.map((f) => ({ value: f, label: RECURRING_FREQUENCY_LABELS[f] }))}
          />
        )}
        {multiMember && (
          <InlineSelect
            value={ownerId}
            onChange={setOwnerId}
            options={[
              { value: "", label: "Shared" },
              ...members.map((m) => ({
                value: m.user.id,
                label: m.user.id === currentUserId ? "You" : m.user.name || m.user.email,
              })),
            ]}
          />
        )}
        <div className="ml-auto flex items-center gap-3">
          <button type="submit" aria-label="Save" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * A native <select> sized to fit its currently selected value, not (as
 * browsers do by default) to its widest option. See recurring/page.tsx for
 * the fuller explanation of the peer-hover/peer-focus trick this reuses.
 */
function InlineSelect({
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
