"use client";

import { useState } from "react";

import { trpc } from "@/trpc/react";
import { ColorBarPicker } from "@/components/finance/color-picker";
import { SettingsSection, inputClass } from "@/components/settings/form";

export default function CategoriesSettingsPage() {
  const utils = trpc.useUtils();
  const { data: categories } = trpc.category.list.useQuery();
  const createCategory = trpc.category.create.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const updateCategory = trpc.category.update.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const deleteCategory = trpc.category.delete.useMutation({
    onSuccess: () => utils.category.list.invalidate(),
  });
  const [newCategory, setNewCategory] = useState("");
  const [newColor, setNewColor] = useState("#7fb8e8");

  return (
    <SettingsSection title="Categories">
      <div>
        {categories?.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b border-border-soft py-2 last:border-none">
            <ColorBarPicker
              value={c.color}
              label={`Change colour of ${c.name}`}
              onChange={(color) => updateCategory.mutate({ id: c.id, color })}
            />
            <input
              defaultValue={c.name}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== c.name) {
                  updateCategory.mutate({ id: c.id, name: e.target.value });
                }
              }}
              className="flex-1 rounded-lg bg-transparent px-2 py-1 text-[13.5px] outline-none focus:bg-surface-2"
            />
            <button
              onClick={() => deleteCategory.mutate({ id: c.id })}
              className="text-[12px] text-text-muted hover:text-critical"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <form
        className="flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCategory.trim()) return;
          createCategory.mutate({ name: newCategory.trim(), color: newColor });
          setNewCategory("");
        }}
      >
        <ColorBarPicker value={newColor} label="Pick a colour for the new category" onChange={setNewColor} />
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder="New category"
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-xl border border-border-soft px-5 py-2.5 text-[13.5px] font-medium text-text-muted hover:text-text"
        >
          Add
        </button>
      </form>
    </SettingsSection>
  );
}
