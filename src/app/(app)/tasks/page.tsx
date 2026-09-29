"use client";

import { useRef, useState } from "react";

import { trpc } from "@/trpc/react";
import { formatDate } from "@/lib/format";
import { RECURRING_FREQUENCY_LABELS, type RecurringFrequency } from "@/lib/constants";
import { TrashIcon, PlusIcon, CloseIcon, CheckIcon, ChevronDownIcon } from "@/components/action-icons";

const FREQUENCIES = Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[];

const COL_DATE = "w-[100px] shrink-0";
const COL_RECURRENCE = "w-[112px] shrink-0";
const COL_ASSIGNEE = "w-[128px] shrink-0";
const COL_ACTIONS = "flex w-[72px] shrink-0 items-center justify-end gap-3";

/** Shared text size for every task property, so title/date/recurrence/assignee all read at the same scale. */
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

function ownerLabel(ownerId: string | null, members: Member[], currentUserId: string) {
  if (ownerId === null) return "Shared";
  if (ownerId === currentUserId) return "You";
  const member = members.find((m) => m.user.id === ownerId);
  return member?.user.name || member?.user.email || "Household member";
}

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

  const [adding, setAdding] = useState(false);

  const members: Member[] = household?.members ?? [];
  const currentUserId = me?.id ?? "";
  const showAssignee = members.length > 1;

  const today = startOfToday();
  const all = (tasks ?? []) as Task[];

  const completed = all.filter((t) => !t.frequency && t.completedAt);
  const active = all.filter((t) => t.frequency || !t.completedAt);
  const overdue = active.filter((t) => t.dueDate && new Date(t.dueDate) < today);
  const upcoming = active.filter((t) => !(t.dueDate && new Date(t.dueDate) < today));

  function handleAdd(values: FormValues) {
    createTask.mutate(
      { ...values, dueDate: values.dueDate ?? undefined, frequency: values.frequency ?? undefined },
      { onSuccess: () => setAdding(false) },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
        <h1 className="px-6 pt-6 pb-4 text-[15px] font-semibold">Tasks</h1>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <TaskTableHeader showAssignee={showAssignee} />

            {overdue.length === 0 && upcoming.length === 0 && !adding && (
              <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">
                Nothing here yet — add one below.
              </p>
            )}

            {overdue.length > 0 && (
              <TaskGroup
                title="Overdue"
                titleClass="text-critical"
                tasks={overdue}
                members={members}
                currentUserId={currentUserId}
                onToggle={(id) => toggleComplete.mutate({ id })}
                onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
                onDelete={(id) => deleteTask.mutate({ id })}
              />
            )}

            {upcoming.length > 0 && (
              <TaskGroup
                tasks={upcoming}
                members={members}
                currentUserId={currentUserId}
                onToggle={(id) => toggleComplete.mutate({ id })}
                onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
                onDelete={(id) => deleteTask.mutate({ id })}
              />
            )}

            {adding ? (
              <InlineTaskRow
                members={members}
                currentUserId={currentUserId}
                onSubmit={handleAdd}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-3 border-b border-border-soft px-6 py-3 text-left text-text-faint transition-colors last:border-b-0 hover:text-text"
              >
                <span className="block h-2.5 w-2.5 shrink-0">
                  <PlusIcon />
                </span>
                <span className={CELL_TEXT}>New task</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {completed.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <TaskTableHeader label="Completed" showAssignee={showAssignee} />
              <TaskGroup
                tasks={completed}
                members={members}
                currentUserId={currentUserId}
                onToggle={(id) => toggleComplete.mutate({ id })}
                onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
                onDelete={(id) => deleteTask.mutate({ id })}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function TaskTableHeader({ label, showAssignee }: { label?: string; showAssignee: boolean }) {
  return (
    <div className="flex items-center gap-4 px-6 py-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-text-faint uppercase">
      <span className="block h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">{label}</div>
      <div className={COL_DATE}>Due date</div>
      <div className={COL_RECURRENCE}>Recurrence</div>
      {showAssignee && <div className={COL_ASSIGNEE}>Assigned to</div>}
      <div className={COL_ACTIONS} />
    </div>
  );
}

function TaskGroup({
  title,
  titleClass,
  tasks,
  members,
  currentUserId,
  onToggle,
  onUpdate,
  onDelete,
}: {
  title?: string;
  titleClass?: string;
  tasks: Task[];
  members: Member[];
  currentUserId: string;
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
          isOverdue={title === "Overdue"}
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
  const isDone = !task.frequency && !!task.completedAt;

  return (
    <div className="flex items-center gap-4 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover">
      <button
        onClick={onToggle}
        aria-label={isDone ? "Mark as not done" : "Mark as done"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          isDone
            ? "border-good bg-good text-white"
            : "border-border text-transparent hover:border-good hover:text-good"
        }`}
      >
        <span className="block h-3 w-3">
          <CheckIcon />
        </span>
      </button>

      <TitleCell
        title={task.title}
        isDone={isDone}
        onCommit={(title) => onUpdate({ title })}
      />

      <DateCell
        width={COL_DATE}
        value={task.dueDate}
        isCritical={isOverdue && !isDone}
        onCommit={(dueDate) => onUpdate({ dueDate })}
      />

      <div className={COL_RECURRENCE}>
        <InlineSelect
          value={task.frequency ?? ""}
          onChange={(v) => onUpdate({ frequency: (v || null) as RecurringFrequency | null })}
          options={[
            { value: "", label: "One-off" },
            ...FREQUENCIES.map((f) => ({ value: f, label: RECURRING_FREQUENCY_LABELS[f] })),
          ]}
        />
      </div>

      {members.length > 1 && (
        <div className={COL_ASSIGNEE}>
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
        </div>
      )}

      <div className={COL_ACTIONS}>
        <button
          onClick={onDelete}
          aria-label={`Delete ${task.title}`}
          className="h-4 w-4 shrink-0 text-text-muted hover:text-critical"
        >
          <TrashIcon />
        </button>
      </div>
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
        className={`min-w-0 flex-1 rounded-md border border-accent bg-surface px-1.5 -mx-1.5 py-0.5 -my-0.5 ${CELL_TEXT} font-medium text-text outline-none`}
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
      className={`min-w-0 flex-1 cursor-pointer truncate text-left ${CELL_TEXT} font-medium ${
        isDone ? "text-text-faint line-through" : ""
      }`}
    >
      {title}
    </button>
  );
}

function DateCell({
  width,
  value,
  isCritical,
  onCommit,
}: {
  width: string;
  value: string | Date | null;
  isCritical: boolean;
  onCommit: (date: Date | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isoValue = value ? new Date(value).toISOString().slice(0, 10) : "";

  if (editing) {
    return (
      <input
        autoFocus
        type="date"
        defaultValue={isoValue}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          setEditing(false);
          onCommit(e.target.value ? new Date(e.target.value) : null);
        }}
        className={`${width} rounded-md border border-accent bg-surface px-1.5 py-0.5 ${CELL_TEXT} text-text outline-none`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`${width} cursor-pointer truncate text-left ${CELL_TEXT} ${
        isCritical && value ? "font-medium text-critical" : "text-text-muted"
      }`}
    >
      {value ? formatDate(value) : "—"}
    </button>
  );
}

function InlineTaskRow({
  members,
  currentUserId,
  onSubmit,
  onCancel,
}: {
  members: Member[];
  currentUserId: string;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
}) {
  const [frequency, setFrequency] = useState<RecurringFrequency | "">("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const multiMember = members.length > 1;

  return (
    <form
      className="flex items-center gap-4 border-b border-border-soft bg-surface px-6 py-2.5 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const dueDateRaw = String(form.get("dueDate") || "");
        onSubmit({
          title: String(form.get("title")),
          dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
          frequency: frequency || null,
          ownerId: multiMember ? ownerId || null : currentUserId,
        });
      }}
    >
      <span className="block h-5 w-5 shrink-0" />
      <input
        name="title"
        required
        autoFocus
        placeholder="Task title"
        className={`min-w-0 flex-1 bg-transparent ${CELL_TEXT} font-medium outline-none placeholder:text-text-faint`}
      />
      <input
        name="dueDate"
        type="date"
        className={`${COL_DATE} rounded-md border border-border bg-surface px-2 py-1 ${CELL_TEXT} text-text outline-none focus:border-accent`}
      />
      <div className={COL_RECURRENCE}>
        <InlineSelect
          value={frequency}
          onChange={(v) => setFrequency(v as RecurringFrequency | "")}
          options={[
            { value: "", label: "One-off" },
            ...FREQUENCIES.map((f) => ({ value: f, label: RECURRING_FREQUENCY_LABELS[f] })),
          ]}
        />
      </div>
      {multiMember && (
        <div className={COL_ASSIGNEE}>
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
        </div>
      )}
      <div className={COL_ACTIONS}>
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
      <span
        className={`pointer-events-none flex items-center gap-0.5 truncate ${CELL_TEXT} text-text-muted transition-colors peer-focus:text-text`}
      >
        {currentLabel}
        <span className="block h-3 w-3 shrink-0">
          <ChevronDownIcon />
        </span>
      </span>
    </span>
  );
}
