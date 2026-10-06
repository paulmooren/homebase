"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { PlusIcon, CloseIcon, CheckIcon } from "@/components/action-icons";
import { ChecklistRow } from "@/components/tasks/checklist-row";
import { AssigneeAvatar } from "@/components/tasks/assignee-avatar";
import { PriorityPill, PRIORITY_ORDER } from "@/components/tasks/priority-pill";
import { CELL_TEXT, type Task, type Member, type TaskPriority } from "@/components/tasks/types";
import { ReminderRow, ScheduleForm, type ReminderData } from "@/components/reminders/reminder-row";
import { useReminderActions } from "@/components/reminders/use-reminders";
import { PopoverMenu } from "@/components/popover-menu";
import { dueBucket, describeSchedule, todayInHousehold, type DueBucket, type ScheduleMode, type ScheduleUnit } from "@/lib/schedule";

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

  return (
    <div className="grid grid-cols-1 gap-10 md:[&>section]:-mx-6 lg:grid-cols-2 lg:gap-x-8 lg:[&>section:first-child]:mr-0 lg:[&>section:last-child]:ml-0">
      <TaskChecklist
        tasks={(tasks ?? []) as Task[]}
        members={members}
        currentUserId={currentUserId}
        onToggle={(id) => toggleComplete.mutate({ id })}
        onUpdate={(id, values) => updateTask.mutate({ id, ...values })}
        onDelete={(id) => deleteTask.mutate({ id })}
        onCreate={(values) => createTask.mutate(values)}
      />
      <RemindersPanel members={members} currentUserId={currentUserId} />
    </div>
  );
}

const BUCKETS: { key: DueBucket; title: string; titleClass?: string }[] = [
  { key: "overdue", title: "Overdue", titleClass: "text-critical" },
  { key: "today", title: "Due today" },
  { key: "week", title: "This week" },
  { key: "later", title: "Later" },
];

/**
 * Recurring chores, grouped by how soon they're due, with pills to look at
 * everyone's, yours, or one person's. Ticking one off records who did it and
 * schedules the next; a toast offers to undo a mis-tap.
 */
function RemindersPanel({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const { data: reminders } = trpc.reminder.list.useQuery();
  const actions = useReminderActions();
  const [filter, setFilter] = useState<"all" | string>("all");
  const [adding, setAdding] = useState(false);
  const today = todayInHousehold();

  const shown = ((reminders ?? []) as ReminderData[]).filter(
    (r) => filter === "all" || r.ownerId === filter || r.ownerId === null,
  );
  const multiMember = members.length > 1;

  return (
    <section>
      {actions.toast}
      <h2 className="px-6 pb-3 text-[17px] font-semibold">Reminders</h2>

      {multiMember && (
        <div className="flex flex-wrap items-center gap-2 px-6 pb-4" role="group" aria-label="Show reminders for">
          {[{ id: "all", label: "All" }, ...members.map((m) => ({ id: m.user.id, label: m.user.id === currentUserId ? "You" : m.user.name || m.user.email }))].map(
            (p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={filter === p.id}
                onClick={() => setFilter(p.id)}
                className={`inline-flex h-8 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                  filter === p.id
                    ? "border-text bg-text text-bg"
                    : "border-transparent bg-surface-2 text-text-muted hover:bg-border-soft hover:text-text"
                }`}
              >
                {p.label}
              </button>
            ),
          )}
        </div>
      )}

      {reminders && shown.length === 0 && !adding && (
        <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">
          Nothing recurring yet — add hoovering, watering the plants, worming the dog…
        </p>
      )}

      {BUCKETS.map(({ key, title, titleClass }) => {
        const inBucket = shown.filter((r) => dueBucket(new Date(r.nextDueDate), today) === key);
        if (inBucket.length === 0) return null;
        return (
          <div key={key}>
            <div className={`px-6 pt-3 pb-1 text-[10.5px] font-semibold tracking-[0.09em] uppercase ${titleClass ?? "text-text-faint"}`}>
              {title}
            </div>
            {inBucket.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                members={members}
                currentUserId={currentUserId}
                today={today}
                onTick={() => actions.tick(r)}
                onUpdate={(patch) => actions.update.mutate({ id: r.id, ...patch })}
                onDelete={() => actions.remove.mutate({ id: r.id })}
              />
            ))}
          </div>
        );
      })}

      {adding ? (
        <NewReminderRow
          members={members}
          currentUserId={currentUserId}
          onAdd={(values) => actions.create.mutate(values)}
          onClose={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-3 border-b border-border-soft px-6 py-3 text-left text-text-faint transition-colors last:border-b-0 hover:text-text"
        >
          <span className="block h-2.5 w-2.5 shrink-0">
            <PlusIcon />
          </span>
          <span className={CELL_TEXT}>New reminder</span>
        </button>
      )}
    </section>
  );
}

/** "+ New reminder": what, how often, who, and when it's first due (today unless you say otherwise). */
function NewReminderRow({
  members,
  currentUserId,
  onAdd,
  onClose,
}: {
  members: Member[];
  currentUserId: string;
  onAdd: (values: {
    title: string;
    intervalCount: number;
    intervalUnit: ScheduleUnit;
    mode: ScheduleMode;
    ownerId: string | null;
    firstDueDate?: Date;
  }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [schedule, setSchedule] = useState<{ intervalCount: number; intervalUnit: ScheduleUnit; mode: ScheduleMode }>({
    intervalCount: 1,
    intervalUnit: "WEEK",
    mode: "FROM_DONE",
  });
  const [ownerId, setOwnerId] = useState<string | null>(currentUserId);
  const multiMember = members.length > 1;

  return (
    <form
      className="flex flex-col gap-3 border-b border-border-soft bg-surface px-6 py-3 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        const form = new FormData(e.currentTarget);
        const first = String(form.get("firstDue") || "");
        onAdd({
          title: title.trim(),
          ...schedule,
          ownerId: multiMember ? ownerId : currentUserId,
          firstDueDate: first ? new Date(first) : undefined,
        });
        setTitle("");
        onClose();
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        maxLength={160}
        placeholder="e.g. Water the plants"
        aria-label="New reminder"
        className={`w-full bg-transparent ${CELL_TEXT} font-medium outline-none placeholder:font-normal placeholder:text-text-faint`}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-text-muted">
        <PopoverMenu
          align="left"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="rounded-full bg-surface-2 px-3 py-1.5 font-medium text-text hover:bg-border-soft">
              {describeSchedule(schedule.intervalCount, schedule.intervalUnit)}
            </button>
          )}
        >
          {({ close }) => (
            <ScheduleForm
              initial={schedule}
              onSave={(patch) => {
                setSchedule(patch);
                close();
              }}
            />
          )}
        </PopoverMenu>
        <label className="flex items-center gap-2">
          First due
          <input
            type="date"
            name="firstDue"
            defaultValue={new Date().toLocaleDateString("en-CA")}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-[12.5px] text-text outline-none focus:border-accent"
          />
        </label>
        {multiMember && (
          <AssigneeAvatar ownerId={ownerId} members={members} currentUserId={currentUserId} onChange={setOwnerId} size={26} />
        )}
        <div className="ml-auto flex items-center gap-3">
          <button type="submit" aria-label="Add reminder" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
            <CheckIcon />
          </button>
          <button type="button" onClick={onClose} aria-label="Cancel" className="h-4 w-4 shrink-0 text-text-muted hover:text-critical">
            <CloseIcon />
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Tasks as a plain checklist: priority and who it's for, nothing else. Open
 * tasks come highest priority first; done ones fold away under "Completed".
 */
function TaskChecklist({
  tasks,
  members,
  currentUserId,
  onToggle,
  onUpdate,
  onDelete,
  onCreate,
}: {
  tasks: Task[];
  members: Member[];
  currentUserId: string;
  onToggle: (id: string) => void;
  onUpdate: (id: string, values: { title?: string; priority?: TaskPriority; ownerId?: string | null }) => void;
  onDelete: (id: string) => void;
  onCreate: (values: { title: string; priority: TaskPriority; ownerId: string | null }) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const open = tasks
    .filter((t) => !t.completedAt)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const completed = tasks.filter((t) => t.completedAt);

  const row = (task: Task) => (
    <ChecklistRow
      key={task.id}
      task={task}
      members={members}
      currentUserId={currentUserId}
      onToggle={() => onToggle(task.id)}
      onUpdate={(values) => onUpdate(task.id, values)}
      onDelete={() => onDelete(task.id)}
    />
  );

  return (
    <section>
      <h2 className="px-6 pb-4 text-[17px] font-semibold">Tasks</h2>

      {open.length === 0 && !adding && (
        <p className="border-b border-border-soft px-6 py-4 text-[13px] text-text-muted">
          Nothing to do — add a task below.
        </p>
      )}

      {open.map(row)}

      {adding ? (
        <NewTaskRow
          members={members}
          currentUserId={currentUserId}
          onAdd={onCreate}
          onClose={() => setAdding(false)}
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

      {completed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            aria-expanded={showCompleted}
            className="flex w-full items-center justify-between px-6 pt-4 pb-1 text-left"
          >
            <span className="text-[10.5px] font-semibold tracking-[0.09em] text-text-faint uppercase">
              Completed · {completed.length}
            </span>
            <span className="text-[12.5px] font-medium text-accent">{showCompleted ? "Hide" : "Show"}</span>
          </button>
          {showCompleted && completed.map(row)}
        </>
      )}
    </section>
  );
}

/** "+ New task": title, priority and assignee on one line; Enter adds it and leaves a fresh line open. */
function NewTaskRow({
  members,
  currentUserId,
  onAdd,
  onClose,
}: {
  members: Member[];
  currentUserId: string;
  onAdd: (values: { title: string; priority: TaskPriority; ownerId: string | null }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [ownerId, setOwnerId] = useState<string | null>(currentUserId);
  const multiMember = members.length > 1;

  return (
    <form
      className="flex items-center gap-3 border-b border-border-soft bg-surface px-6 py-2.5 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd({ title: title.trim(), priority, ownerId: multiMember ? ownerId : currentUserId });
        setTitle("");
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <span className="block h-6 w-6 shrink-0 rounded-lg border border-dashed border-border" aria-hidden />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        required
        maxLength={160}
        placeholder="What needs doing?"
        aria-label="New task"
        className={`min-w-0 flex-1 bg-transparent ${CELL_TEXT} font-medium outline-none placeholder:font-normal placeholder:text-text-faint`}
      />
      <PriorityPill value={priority} onChange={setPriority} />
      {multiMember && (
        <AssigneeAvatar ownerId={ownerId} members={members} currentUserId={currentUserId} onChange={setOwnerId} />
      )}
      <button type="submit" aria-label="Add task" className="h-4 w-4 shrink-0 text-good hover:opacity-80">
        <CheckIcon />
      </button>
      <button type="button" onClick={onClose} aria-label="Done adding" className="h-4 w-4 shrink-0 text-text-muted hover:text-critical">
        <CloseIcon />
      </button>
    </form>
  );
}
