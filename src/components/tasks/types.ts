export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

/** A one-off task: a checklist item with a priority and an assignee (null = everyone). */
export type Task = {
  id: string;
  title: string;
  priority: TaskPriority;
  completedAt: string | Date | null;
  ownerId: string | null;
};

export type Member = { user: { id: string; name: string | null; email: string; image?: string | null } };

/** Shared text size for a task's title, so it reads at a consistent scale everywhere. */
export const CELL_TEXT = "text-[14px]";
