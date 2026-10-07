/**
 * Puts the items with these ids in this order, the way the server does: they
 * swap the positions they already hold, among themselves, so every other item
 * keeps its place. Used to show a drop at once, before the server has answered.
 */
export function applyReorder<T extends { id: string; sortOrder: number; createdAt: Date | string }>(
  items: T[],
  ids: string[],
): T[] {
  const moved = new Set(ids);
  const slots = items
    .filter((i) => moved.has(i.id))
    .map((i) => i.sortOrder)
    .sort((a, b) => a - b);
  const position = new Map(ids.map((id, index) => [id, slots[index]]));
  return items
    .map((i) => (position.has(i.id) ? { ...i, sortOrder: position.get(i.id)! } : i))
    .sort((a, b) => a.sortOrder - b.sortOrder || +new Date(a.createdAt) - +new Date(b.createdAt));
}
