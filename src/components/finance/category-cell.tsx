"use client";

import { Select } from "@base-ui/react/select";
import { ChevronDownIcon } from "@/components/action-icons";
import { SelectPopup } from "@/components/ui/select";

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
  const options = [
    { value: "", label: "No category" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <span className="relative inline-flex w-full items-center">
      <Select.Root
        items={options}
        value={categoryId ?? ""}
        onValueChange={(v) => onChange(v || null)}
      >
        <Select.Trigger
          className={`flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left outline-none ${CELL_TEXT} text-text-muted`}
        >
          <span
            className="block h-2 w-2 shrink-0 rounded-full"
            style={{ background: current?.color ?? "#c7c9cf" }}
          />
          <Select.Value className="truncate" />
          <Select.Icon className="block h-3 w-3 shrink-0">
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <SelectPopup options={options} />
      </Select.Root>
    </span>
  );
}
