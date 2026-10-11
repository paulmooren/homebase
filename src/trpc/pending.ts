import type { QueryPath } from "@/trpc/optimistic";

/** How many changes are in flight per list: the quiet refetch waits for the last one. */
export const pending = new Map<QueryPath, number>();

/** True while any change at all is still being saved (a refetch landing now could bring old data back). */
export function hasAnyPendingChanges() {
  return pending.size > 0;
}
