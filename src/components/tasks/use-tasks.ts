"use client";

import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { useOptimisticMutation } from "@/trpc/optimistic";
import type { TaskPriority } from "@/components/tasks/types";

/** Todo mutations shared by the Tasks page and the dashboard. Every change shows at once and saves behind the scenes. */
export function useTaskActions() {
  const utils = trpc.useUtils();
  // The Todo rows carry their assignee's name, which a new or reassigned row takes from the loaded household.
  const ownerOf = (ownerId: string | null | undefined) => {
    const user = ownerId ? utils.household.current.getData()?.members.find((m) => m.user.id === ownerId)?.user : undefined;
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  };

  const lists = ["task.list"] as const;
  const scope = (v: { id?: string }) => (v.id ? `task:${v.id}` : undefined);

  const create = useOptimisticMutation("task.create", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("task.list", (rows) => [
        ...rows,
        {
          id: v.id ?? newId(),
          householdId: utils.household.current.getData()?.id ?? "",
          ownerId: v.ownerId ?? null,
          title: v.title,
          priority: v.priority ?? "MEDIUM",
          dueDate: null,
          frequency: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: ownerOf(v.ownerId),
        },
      ]),
  });
  const update = useOptimisticMutation("task.update", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("task.list", (rows) =>
        rows.map((row) =>
          row.id !== v.id
            ? row
            : {
                ...row,
                ...(v.title !== undefined ? { title: v.title } : {}),
                ...(v.priority !== undefined ? { priority: v.priority } : {}),
                ...(v.ownerId !== undefined ? { ownerId: v.ownerId, owner: ownerOf(v.ownerId) } : {}),
              },
        ),
      ),
  });
  const toggleComplete = useOptimisticMutation("task.toggleComplete", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("task.list", (rows) =>
        rows.map((row) => (row.id === v.id ? { ...row, completedAt: row.completedAt ? null : new Date() } : row)),
      ),
  });
  const remove = useOptimisticMutation("task.delete", {
    lists,
    scope,
    update: (v, cache) => cache.update("task.list", (rows) => rows.filter((row) => row.id !== v.id)),
  });

  return {
    create: (values: { title: string; priority: TaskPriority; ownerId: string | null }) =>
      create.mutate({ id: newId(), ...values }),
    update: (id: string, values: { title?: string; priority?: TaskPriority; ownerId?: string | null }) =>
      update.mutate({ id, ...values }),
    toggle: (id: string) => toggleComplete.mutate({ id }),
    remove: (id: string) => remove.mutate({ id }),
  };
}
