"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { Toast, toastPrimary, toastSecondary } from "@/components/toast";

const formatNext = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Reminder mutations shared by the Reminders page and the dashboard, plus the "done — undo" toast. */
export function useReminderActions() {
  const utils = trpc.useUtils();
  const refresh = () => utils.reminder.list.invalidate();
  const [undo, setUndo] = useState<{ completionId: string; title: string; next: string } | null>(null);

  const create = trpc.reminder.create.useMutation({ onSuccess: refresh });
  const update = trpc.reminder.update.useMutation({ onSuccess: refresh });
  const remove = trpc.reminder.delete.useMutation({ onSuccess: refresh });
  const undoComplete = trpc.reminder.undoComplete.useMutation({ onSuccess: refresh });
  const complete = trpc.reminder.complete.useMutation({ onSuccess: refresh });

  function tick(reminder: { id: string; title: string }) {
    complete.mutate(
      { id: reminder.id },
      {
        onSuccess: (result) =>
          setUndo({ completionId: result.completionId, title: reminder.title, next: formatNext(result.nextDueDate) }),
      },
    );
  }

  const toast = undo && (
    <Toast
      durationMs={8000}
      onClose={() => setUndo(null)}
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              undoComplete.mutate({ completionId: undo.completionId });
              setUndo(null);
            }}
            className={toastPrimary}
          >
            Undo
          </button>
          <button type="button" onClick={() => setUndo(null)} className={toastSecondary}>
            Close
          </button>
        </>
      }
    >
      <p className="font-semibold">✓ {undo.title} done</p>
      <p className="mt-0.5 text-bg/75">Next due {undo.next}</p>
    </Toast>
  );

  return { create, update, remove, tick, toast };
}
