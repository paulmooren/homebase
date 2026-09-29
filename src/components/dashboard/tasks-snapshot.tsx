"use client";

import Link from "next/link";

import { trpc } from "@/trpc/react";
import { formatDate } from "@/lib/format";
import { CheckIcon } from "@/components/action-icons";

type Task = {
  id: string;
  title: string;
  dueDate: string | Date | null;
  frequency: string | null;
  completedAt: string | Date | null;
  ownerId: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * "What needs my attention" — tasks/reminders assigned to me or shared
 * (never another member's). Every overdue item, uncapped — hiding one would
 * defeat the point — then the next 5 upcoming by due date, then anything
 * with no due date at all (undated items aren't dropped, just deprioritized
 * below anything with a real deadline). Checkbox is interactive (same
 * toggleComplete as the Tasks page: reschedules a recurring reminder,
 * permanently completes a one-off task); everything else (editing, assignee,
 * recurrence) stays on the Tasks page.
 */
export function TasksSnapshot() {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.task.list.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const toggleComplete = trpc.task.toggleComplete.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  if (!tasks || !me) return null;

  const currentUserId = me.id;
  const today = startOfToday();

  const relevant = (tasks as Task[]).filter(
    (t) =>
      (t.ownerId === null || t.ownerId === currentUserId) &&
      (t.frequency || !t.completedAt),
  );

  const dated = relevant.filter((t) => t.dueDate);
  const undated = relevant.filter((t) => !t.dueDate);

  const byDueDate = (a: Task, b: Task) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();

  const overdue = dated.filter((t) => new Date(t.dueDate!) < today).sort(byDueDate);
  const upcoming = dated
    .filter((t) => new Date(t.dueDate!) >= today)
    .sort(byDueDate)
    .slice(0, 5);

  if (overdue.length === 0 && upcoming.length === 0 && undated.length === 0) return null;

  return (
    <section className="mb-5 rounded-[20px] border border-border-soft bg-surface p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Tasks</h2>
        <Link href="/tasks" className="text-[12.5px] font-medium text-accent hover:opacity-80">
          View all
        </Link>
      </div>
      {overdue.map((task) => (
        <TaskSnapshotRow
          key={task.id}
          task={task}
          overdue
          onToggle={() => toggleComplete.mutate({ id: task.id })}
        />
      ))}
      {upcoming.map((task) => (
        <TaskSnapshotRow
          key={task.id}
          task={task}
          overdue={false}
          onToggle={() => toggleComplete.mutate({ id: task.id })}
        />
      ))}
      {undated.map((task) => (
        <TaskSnapshotRow
          key={task.id}
          task={task}
          overdue={false}
          onToggle={() => toggleComplete.mutate({ id: task.id })}
        />
      ))}
    </section>
  );
}

function TaskSnapshotRow({
  task,
  overdue,
  onToggle,
}: {
  task: Task;
  overdue: boolean;
  onToggle: () => void;
}) {
  const isDone = !task.frequency && !!task.completedAt;

  return (
    <div className="flex items-center gap-3 border-b border-border-soft py-2.5 last:border-none">
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
      <span
        className={`min-w-0 flex-1 truncate text-[13.5px] ${
          isDone ? "text-text-faint line-through" : "font-medium"
        }`}
      >
        {task.title}
      </span>
      <span className={`shrink-0 text-[12px] ${overdue && !isDone ? "font-medium text-critical" : "text-text-muted"}`}>
        {task.dueDate ? formatDate(task.dueDate) : "No due date"}
      </span>
    </div>
  );
}
