"use client";

import { useState } from "react";

import { CheckIcon, TrashIcon } from "@/components/action-icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InlineEdit } from "@/components/inline-edit";
import { AssigneeAvatar } from "@/components/tasks/assignee-avatar";
import { PriorityPill } from "@/components/tasks/priority-pill";
import type { Member, Task, TaskPriority } from "@/components/tasks/types";

/**
 * One line of the task checklist: tick box, a title you can click to rename,
 * a priority pill and who it's for. No dates, no repeats — a task is a thing
 * to do once.
 */
export function ChecklistRow({
  task,
  members,
  currentUserId,
  onToggle,
  onUpdate,
  onDelete,
}: {
  task: Task;
  members: Member[];
  currentUserId: string;
  onToggle: () => void;
  onUpdate: (values: { title?: string; priority?: TaskPriority; ownerId?: string | null }) => void;
  onDelete: () => void;
}) {
  const done = !!task.completedAt;
  const [confirming, setConfirming] = useState(false);
  const multiMember = members.length > 1;

  return (
    <div className="group flex items-center gap-3 border-b border-border-soft px-6 py-2.5 transition-colors last:border-b-0 hover:bg-surface-hover">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        aria-pressed={done}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          done ? "border-good bg-good text-white" : "border-border text-transparent hover:border-good hover:text-good"
        }`}
      >
        <span className="block h-3.5 w-3.5">
          <CheckIcon />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <InlineEdit
          value={task.title}
          ariaLabel="Task"
          onCommit={(title) => onUpdate({ title })}
          display={<span className={done ? "line-through" : ""}>{task.title}</span>}
          className={`text-[14px] font-medium ${done ? "text-text-faint" : ""}`}
          buttonClassName="block w-full cursor-pointer truncate text-left"
        />
      </div>

      <PriorityPill value={task.priority} onChange={(priority) => onUpdate({ priority })} muted={done} />

      {multiMember && (
        <AssigneeAvatar
          ownerId={task.ownerId}
          members={members}
          currentUserId={currentUserId}
          onChange={(ownerId) => onUpdate({ ownerId })}
        />
      )}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${task.title}`}
        className="h-4 w-4 shrink-0 text-text-faint hover:text-critical md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
      >
        <TrashIcon />
      </button>

      {confirming && (
        <ConfirmDialog
          title={`Delete "${task.title}"?`}
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
