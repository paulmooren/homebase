"use client";

import { useState } from "react";
import { Button } from "@base-ui/react/button";

import { newId } from "@/lib/client-id";
import { nextDueDate, todayInHousehold, type ScheduleMode, type ScheduleUnit } from "@/lib/schedule";
import { trpc } from "@/trpc/react";
import { asDate, useOptimisticMutation } from "@/trpc/optimistic";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";

const formatNext = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The list's own order: soonest due first, then by title. */
const byDue = (a: { nextDueDate: Date; title: string }, b: { nextDueDate: Date; title: string }) =>
  a.nextDueDate.getTime() - b.nextDueDate.getTime() || a.title.localeCompare(b.title);

/** Reminder mutations shared by the Reminders page and the dashboard, plus the "done — undo" toast. */
export function useReminderActions() {
  const utils = trpc.useUtils();
  const [undo, setUndo] = useState<{ completionId: string; reminderId: string; title: string; next: string } | null>(null);

  const lists = ["reminder.list"] as const;
  const scope = (v: { id: string }) => `reminder:${v.id}`;
  const createMutation = useOptimisticMutation("reminder.create", {
    lists,
    scope: (v) => (v.id ? `reminder:${v.id}` : undefined),
    update: (v, cache) =>
      cache.update("reminder.list", (rows) =>
        [
          ...rows,
          {
            id: v.id ?? newId(),
            householdId: utils.household.current.getData()?.id ?? "",
            ownerId: v.ownerId,
            title: v.title,
            intervalCount: v.intervalCount,
            intervalUnit: v.intervalUnit,
            mode: v.mode,
            nextDueDate: v.firstDueDate ? asDate(v.firstDueDate) : todayInHousehold(),
            createdAt: new Date(),
            updatedAt: new Date(),
            completions: [],
          },
        ].sort(byDue),
      ),
  });
  const updateMutation = useOptimisticMutation("reminder.update", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("reminder.list", (rows) =>
        rows
          .map((row) =>
            row.id === v.id
              ? {
                  ...row,
                  ...(v.title !== undefined ? { title: v.title } : {}),
                  ...(v.intervalCount !== undefined ? { intervalCount: v.intervalCount } : {}),
                  ...(v.intervalUnit !== undefined ? { intervalUnit: v.intervalUnit } : {}),
                  ...(v.mode !== undefined ? { mode: v.mode } : {}),
                  ...(v.ownerId !== undefined ? { ownerId: v.ownerId } : {}),
                  ...(v.nextDueDate !== undefined ? { nextDueDate: asDate(v.nextDueDate) } : {}),
                }
              : row,
          )
          .sort(byDue),
      ),
  });
  const removeMutation = useOptimisticMutation("reminder.delete", {
    lists,
    scope,
    update: (v, cache) => cache.update("reminder.list", (rows) => rows.filter((row) => row.id !== v.id)),
  });
  const completeMutation = useOptimisticMutation("reminder.complete", {
    lists,
    scope,
    update: (v, cache) => {
      const me = utils.user.me.getData();
      cache.update("reminder.list", (rows) =>
        rows
          .map((row) => {
            if (row.id !== v.id) return row;
            const next = nextDueDate({
              mode: row.mode,
              dueDate: row.nextDueDate,
              today: todayInHousehold(),
              count: row.intervalCount,
              unit: row.intervalUnit,
            });
            const completion = {
              id: v.completionId ?? newId(),
              reminderId: row.id,
              completedById: me?.id ?? null,
              completedAt: new Date(),
              dueDateAtCompletion: row.nextDueDate,
              completedBy: me ? { id: me.id, name: me.name, email: me.email } : null,
            };
            return { ...row, nextDueDate: next, completions: [completion, ...row.completions].slice(0, 5) };
          })
          .sort(byDue),
      );
    },
  });
  const undoMutation = useOptimisticMutation("reminder.undoComplete", {
    lists,
    scope: (v) => `reminder:${v.reminderId}`,
    update: (v, cache) =>
      cache.update("reminder.list", (rows) =>
        rows
          .map((row) => {
            const completion = row.completions.find((c) => c.id === v.completionId);
            if (row.id !== v.reminderId || !completion) return row;
            return {
              ...row,
              nextDueDate: completion.dueDateAtCompletion ?? row.nextDueDate,
              completions: row.completions.filter((c) => c.id !== v.completionId),
            };
          })
          .sort(byDue),
      ),
  });

  const create = {
    mutate: (values: Omit<Parameters<typeof createMutation.mutate>[0], "id">) => createMutation.mutate({ id: newId(), ...values }),
  };
  const update = { mutate: updateMutation.mutate };
  const remove = { mutate: removeMutation.mutate };

  function tick(reminder: { id: string; title: string; mode: ScheduleMode; nextDueDate: Date | string; intervalCount: number; intervalUnit: ScheduleUnit }) {
    const completionId = newId();
    const next = nextDueDate({
      mode: reminder.mode,
      dueDate: new Date(reminder.nextDueDate),
      today: todayInHousehold(),
      count: reminder.intervalCount,
      unit: reminder.intervalUnit,
    });
    setUndo({ completionId, reminderId: reminder.id, title: reminder.title, next: formatNext(next) });
    completeMutation.mutate({ id: reminder.id, completionId }, { onError: () => setUndo(null) });
  }

  const toast = undo && (
    <Toast
      durationMs={8000}
      onClose={() => setUndo(null)}
      actions={
        <>
          <Button
            type="button"
            onClick={() => {
              undoMutation.mutate({ completionId: undo.completionId, reminderId: undo.reminderId });
              setUndo(null);
            }}
            className={toastPrimary}
          >
            Undo
          </Button>
          <Button type="button" onClick={() => setUndo(null)} className={toastSecondary}>
            Close
          </Button>
        </>
      }
    >
      <p className="font-semibold">✓ {undo.title} done</p>
      <p className="mt-0.5 text-bg/75">Next due {undo.next}</p>
    </Toast>
  );

  return { create, update, remove, tick, toast };
}
