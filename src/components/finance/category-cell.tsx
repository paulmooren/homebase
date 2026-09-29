import { ChevronDownIcon } from "@/components/action-icons";

export type Category = { id: string; name: string; color: string };

const CELL_TEXT = "text-[14px]";

export function CategoryCell({
  categoryId,
  categories,
  onChange,
}: {
  categoryId: string | null;
  categories: Category[];
  onChange: (categoryId: string | null) => void;
}) {
  const current = categories.find((c) => c.id === categoryId);

  return (
    <span className="relative inline-flex w-full items-center">
      <select
        value={categoryId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <span className={`pointer-events-none flex items-center gap-1.5 truncate ${CELL_TEXT} text-text-muted`}>
        <span
          className="block h-2 w-2 shrink-0 rounded-full"
          style={{ background: current?.color ?? "#c7c9cf" }}
        />
        <span className="truncate">{current ? current.name : "No category"}</span>
        <span className="block h-3 w-3 shrink-0">
          <ChevronDownIcon />
        </span>
      </span>
    </span>
  );
}
