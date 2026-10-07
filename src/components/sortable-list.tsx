"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

/**
 * A vertical list whose rows can be dragged into a new order — by mouse, by
 * finger or from the keyboard (focus a row's grip, Space, arrow keys, Space).
 * Rows are `useSortable` components (see `useSortableRow`); this only holds
 * the drag context and reports the new order of ids when one is dropped.
 */
export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    // A small movement before it counts as a drag, so a plain click on the grip does nothing.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** A section of a board: its rows are reordered inside it, and a row dropped on it (even empty) joins it. */
export const SECTION_PREFIX = "section:";

export type BoardSection = { id: string; ids: string[] };

export type BoardDrop = {
  /** The row that was dropped. */
  id: string;
  from: string;
  to: string;
  /** The row ids of the section it landed in, in their new order (the dropped row included). */
  ids: string[];
};

/**
 * Several sortable sections side by side in one drag context, so a row can be
 * reordered inside its section or dragged into another. Sections are
 * `SortableSection`s whose ids start with `section:`.
 */
export function SortableBoard({
  sections,
  onDrop,
  children,
}: {
  sections: BoardSection[];
  onDrop: (drop: BoardDrop) => void;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Prefer the row under the pointer; fall back to the nearest row; an empty section is then the target.
  const collisionDetection: CollisionDetection = (args) => {
    const isSection = (id: string | number) => String(id).startsWith(SECTION_PREFIX);
    const under = pointerWithin(args);
    if (under.length > 0) {
      const rows = under.filter((c) => !isSection(c.id));
      return rows.length > 0 ? rows : under;
    }
    const rows = args.droppableContainers.filter((c) => !isSection(c.id));
    return closestCenter({ ...args, droppableContainers: rows.length > 0 ? rows : args.droppableContainers });
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const from = sections.find((s) => s.ids.includes(activeId));
    const to = sections.find((s) => s.id === overId) ?? sections.find((s) => s.ids.includes(overId));
    if (!from || !to) return;

    if (from.id === to.id) {
      if (activeId === overId) return;
      onDrop({ id: activeId, from: from.id, to: to.id, ids: arrayMove(to.ids, to.ids.indexOf(activeId), to.ids.indexOf(overId)) });
      return;
    }
    // Into another section: just before the row it was dropped on, or at the end when dropped on the section itself.
    const at = overId === to.id ? to.ids.length : to.ids.indexOf(overId);
    onDrop({ id: activeId, from: from.id, to: to.id, ids: [...to.ids.slice(0, at), activeId, ...to.ids.slice(at)] });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}

export function SortableSection({
  id,
  ids,
  empty,
  children,
}: {
  id: string;
  ids: string[];
  /** Shown when the section has no rows, so there is somewhere to drop. */
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={isOver && ids.length === 0 ? "bg-surface-2" : ""}>
        {children}
        {ids.length === 0 && empty}
      </div>
    </SortableContext>
  );
}
