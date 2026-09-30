"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { TaskRow, type Task, type Member, type FormValues } from "@/components/tasks/task-row";

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
 * below anything with a real deadline). Uses the exact same TaskRow as the
 * Tasks page — full inline editing (title, date, recurrence, assignee,
 * delete), not a read-only preview — so the dashboard is a real shortcut,
 * not a lesser copy.
 *
 * `justCompleted` keeps a one-off task visible (struck through) for this
 * render after you check it off, instead of it vanishing the instant the
 * refetch lands — otherwise ticking a task here gives no visible
 * confirmation at all before it's gone.
 */
export function TasksSnapshot() {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.task.list.useQuery();
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());

  const toggleComplete = trpc.task.toggleComplete.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });
  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => utils.task.list.invalidate(),
  });

  if (!tasks || !me) return null;

  const currentUserId = me.id;
  const members: Member[] = household?.members ?? [];
  const today = startOfToday();

  const relevant = (tasks as Task[]).filter(
    (t) =>
      (t.ownerId === null || t.ownerId === currentUserId) &&
      (t.frequency || !t.completedAt || justCompleted.has(t.id)),
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

  const rows = [...overdue, ...upcoming, ...undated];

  return (
    <section className="mb-5 overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <div className="mb-1 flex items-baseline justify-between px-6 pt-6">
        <h2 className="text-[15px] font-semibold">Tasks</h2>
        <Link href="/tasks" className="text-[12.5px] font-medium text-accent hover:opacity-80">
          View all
        </Link>
      </div>
      {rows.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          members={members}
          currentUserId={currentUserId}
          isOverdue={overdue.includes(task)}
          onToggle={() => {
            if (!task.frequency && !task.completedAt) {
              setJustCompleted((prev) => new Set(prev).add(task.id));
            }
            toggleComplete.mutate({ id: task.id });
          }}
          onUpdate={(values: Partial<FormValues>) => updateTask.mutate({ id: task.id, ...values })}
          onDelete={() => deleteTask.mutate({ id: task.id })}
        />
      ))}
    </section>
  );
}
