"use client";

import { useState } from "react";
import Link from "next/link";

import { trpc } from "@/trpc/react";
import { VaultIcon } from "@/components/nav-icons";
import { daysUntil } from "@/lib/vault";
import { formatDate } from "@/lib/format";
import { ChecklistRow } from "@/components/tasks/checklist-row";
import { PRIORITY_ORDER } from "@/components/tasks/priority-pill";
import type { Task, Member } from "@/components/tasks/types";
import { ReminderRow, type ReminderData } from "@/components/reminders/reminder-row";
import { useReminderActions } from "@/components/reminders/use-reminders";
import { dueBucket, todayInHousehold } from "@/lib/schedule";

/**
 * "What needs my attention": Reminders due today or overdue that are mine or
 * everyone's, Vault expiries coming up, and my open Tasks (highest priority
 * first). Never another member's reminder or task. It uses the same rows as
 * the Tasks page, so everything is editable right here — and ticking a
 * Reminder shows the same "Undo" toast.
 *
 * `justCompleted` keeps a Task visible (struck through) for this render after
 * you check it off, instead of it vanishing the instant the refetch lands.
 */
export function TasksSnapshot({ showTasks = true, showVault = false }: { showTasks?: boolean; showVault?: boolean }) {
  const utils = trpc.useUtils();
  const { data: tasks } = trpc.task.list.useQuery(undefined, { enabled: showTasks });
  const { data: reminders } = trpc.reminder.list.useQuery(undefined, { enabled: showTasks });
  const { data: expiring } = trpc.vault.expiringSoon.useQuery(undefined, { enabled: showVault });
  const { data: household } = trpc.household.current.useQuery();
  const { data: me } = trpc.user.me.useQuery();
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const reminderActions = useReminderActions();

  const toggleComplete = trpc.task.toggleComplete.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const updateTask = trpc.task.update.useMutation({ onSuccess: () => utils.task.list.invalidate() });
  const deleteTask = trpc.task.delete.useMutation({ onSuccess: () => utils.task.list.invalidate() });

  if ((showTasks && (!tasks || !reminders)) || !me) return null;

  const currentUserId = me.id;
  const members: Member[] = household?.members ?? [];
  const today = todayInHousehold();

  const mine = <T extends { ownerId: string | null }>(items: T[]) =>
    items.filter((i) => i.ownerId === null || i.ownerId === currentUserId);

  const dueReminders = showTasks
    ? mine((reminders ?? []) as ReminderData[]).filter((r) => {
        const b = dueBucket(new Date(r.nextDueDate), today);
        return b === "overdue" || b === "today";
      })
    : [];

  const checklist = showTasks
    ? mine((tasks ?? []) as Task[])
        .filter((t) => !t.completedAt || justCompleted.has(t.id))
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    : [];

  // Vault expiries are never capped — an expiring passport must not be pushed out by a long list.
  const vaultRows = (showVault ? (expiring ?? []) : []).map((e) => ({ ...e, date: new Date(e.expiresOn!) }));

  if (dueReminders.length === 0 && checklist.length === 0 && vaultRows.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[20px] border border-border-soft bg-surface">
      {reminderActions.toast}
      <div className="mb-1 flex items-baseline justify-between px-6 pt-6">
        <h2 className="text-[15px] font-semibold">{showTasks ? "Tasks" : "Coming up"}</h2>
        <Link href={showTasks ? "/tasks" : "/vault"} className="text-[12.5px] font-medium text-accent hover:opacity-80">
          View all
        </Link>
      </div>

      {dueReminders.map((r) => (
        <ReminderRow
          key={r.id}
          reminder={r}
          members={members}
          currentUserId={currentUserId}
          today={today}
          compact
          onTick={() => reminderActions.tick(r)}
          onUpdate={(patch) => reminderActions.update.mutate({ id: r.id, ...patch })}
          onDelete={() => reminderActions.remove.mutate({ id: r.id })}
        />
      ))}

      {vaultRows.map((e) => (
        <VaultExpiryRow key={`vault-${e.id}`} title={e.title} date={e.date} />
      ))}

      {checklist.map((task) => (
        <ChecklistRow
          key={task.id}
          task={task}
          members={members}
          currentUserId={currentUserId}
          onToggle={() => {
            if (!task.completedAt) setJustCompleted((prev) => new Set(prev).add(task.id));
            toggleComplete.mutate({ id: task.id });
          }}
          onUpdate={(values) => updateTask.mutate({ id: task.id, ...values })}
          onDelete={() => deleteTask.mutate({ id: task.id })}
        />
      ))}
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
