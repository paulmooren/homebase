"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { VaultIcon } from "@/components/nav-icons";
import { daysUntil } from "@/lib/vault";
import { formatDate } from "@/lib/format";
import { ChecklistRow } from "@/components/tasks/checklist-row";
import { PRIORITY_ORDER } from "@/components/tasks/priority-pill";
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
export function TasksSnapshot({ showTasks = true, showVault = false }: { showTasks?: boolean; showVault?: boolean }) {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.task.list.useQuery(undefined, { enabled: showTasks });
  const { data: expiring } = trpc.vault.expiringSoon.useQuery(undefined, { enabled: showVault });
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

  if ((showTasks && !tasks) || !me) return null;

  const currentUserId = me.id;
  const members: Member[] = household?.members ?? [];
  const today = startOfToday();

  const relevant = ((showTasks ? tasks : []) as Task[]).filter(
    (t) =>
      (t.ownerId === null || t.ownerId === currentUserId) &&
      (t.frequency || !t.completedAt || justCompleted.has(t.id)),
  );

  // Reminders repeat and have due dates; tasks are an undated checklist, highest priority first.
  const reminders = relevant.filter((t) => t.frequency);
  const checklist = relevant
    .filter((t) => !t.frequency)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const dated = reminders.filter((t) => t.dueDate);
  const undated = reminders.filter((t) => !t.dueDate);

  const byDueDate = (a: Task, b: Task) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();

  const overdue = dated.filter((t) => new Date(t.dueDate!) < today).sort(byDueDate);
  const upcoming = dated
    .filter((t) => new Date(t.dueDate!) >= today)
    .sort(byDueDate)
    .slice(0, 5);

  // Vault expiries ride along in the same dated list. They are never capped
  // like tasks are — an expiring passport must not be pushed out by five tasks.
  const vaultRows = (showVault ? (expiring ?? []) : []).map((e) => ({ ...e, date: new Date(e.expiresOn!) }));
  const vaultOverdue = vaultRows.filter((e) => daysUntil(e.date) < 0);
  const vaultUpcoming = vaultRows.filter((e) => daysUntil(e.date) >= 0);

  type Row =
    | { kind: "task" | "check"; task: Task; date: Date }
    | { kind: "vault"; id: string; title: string; date: Date };
  const byDate = (a: Row, b: Row) => a.date.getTime() - b.date.getTime();
  const asTask = (task: Task): Row => ({ kind: "task", task, date: new Date(task.dueDate!) });
  const asVault = (e: { id: string; title: string; date: Date }): Row => ({ kind: "vault", ...e });

  const overdueRows = [...overdue.map(asTask), ...vaultOverdue.map(asVault)].sort(byDate);
  const upcomingRows = [...upcoming.map(asTask), ...vaultUpcoming.map(asVault)].sort(byDate);
  const undatedRows: Row[] = undated.map((task) => ({ kind: "task", task, date: new Date(0) }));
  const checklistRows: Row[] = checklist.map((task) => ({ kind: "check", task, date: new Date(0) }));

  const rows = [...overdueRows, ...upcomingRows, ...undatedRows, ...checklistRows];
  if (rows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      <div className="mb-1 flex items-baseline justify-between px-6 pt-6">
        <h2 className="text-[15px] font-semibold">{showTasks ? "Tasks" : "Coming up"}</h2>
        <Link href={showTasks ? "/tasks" : "/vault"} className="text-[12.5px] font-medium text-accent hover:opacity-80">
          View all
        </Link>
      </div>
      {rows.map((row) =>
        row.kind === "vault" ? (
          <VaultExpiryRow key={`vault-${row.id}`} title={row.title} date={row.date} />
        ) : row.kind === "check" ? (
          <ChecklistRow
            key={row.task.id}
            task={row.task}
            members={members}
            currentUserId={currentUserId}
            onToggle={() => {
              if (!row.task.completedAt) setJustCompleted((prev) => new Set(prev).add(row.task.id));
              toggleComplete.mutate({ id: row.task.id });
            }}
            onUpdate={(values) => updateTask.mutate({ id: row.task.id, ...values })}
            onDelete={() => deleteTask.mutate({ id: row.task.id })}
          />
        ) : (
          <TaskRow
            key={row.task.id}
            task={row.task}
            members={members}
            currentUserId={currentUserId}
            isOverdue={overdue.includes(row.task)}
            onToggle={() => {
              if (!row.task.frequency && !row.task.completedAt) {
                setJustCompleted((prev) => new Set(prev).add(row.task.id));
              }
              toggleComplete.mutate({ id: row.task.id });
            }}
            onUpdate={(values: Partial<FormValues>) => updateTask.mutate({ id: row.task.id, ...values })}
            onDelete={() => deleteTask.mutate({ id: row.task.id })}
          />
        ),
      )}
    </section>
  );
}

/** A Vault entry's expiry as a read-only dated line — title and date only, never a value. */
function VaultExpiryRow({ title, date }: { title: string; date: Date }) {
  const overdue = daysUntil(date) < 0;
  return (
    <Link
      href="/vault"
      className="flex items-center gap-3 border-b border-border-soft px-6 py-3 transition-colors last:border-b-0 hover:bg-surface-hover"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">
        <span className="block h-4 w-4">
          <VaultIcon />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{title} expires</div>
        <div className={`text-[12px] ${overdue ? "font-medium text-critical" : "text-text-muted"}`}>
          {formatDate(date)}
          {overdue ? " · overdue" : ""}
        </div>
      </div>
    </Link>
  );
}
