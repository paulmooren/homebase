"use client";

import { newId } from "@/lib/client-id";
import { trpc } from "@/trpc/react";
import { asDate, useOptimisticMutation } from "@/trpc/optimistic";
import type { VaultFormValues } from "@/components/vault/entry-form";

/**
 * Vault mutations. Creating, editing, deleting and changing Visibility show at once; what the screen shows of an
 * entry is only its title, labels and dates, so there is nothing secret to predict. Revealing a secret is not here:
 * it waits for the server, which decrypts it.
 */
export function useVaultActions() {
  const utils = trpc.useUtils();
  const lists = ["vault.list", "vault.expiringSoon"] as const;
  const scope = (v: { id?: string }) => (v.id ? `vault:${v.id}` : undefined);
  const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

  const create = useOptimisticMutation("vault.create", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("vault.list", (rows) =>
        [
          ...rows,
          {
            id: v.id ?? newId(),
            title: v.title,
            category: v.category,
            expiresOn: v.expiresOn ? asDate(v.expiresOn) : null,
            ownerId: v.shared ? null : (utils.user.me.getData()?.id ?? null),
            visibleToHousehold: true,
            fieldLabels: v.fields.map((f) => f.label),
            hasNote: !!v.note,
          },
        ].sort(byTitle),
      ),
  });
  const update = useOptimisticMutation("vault.update", {
    lists,
    scope,
    update: (v, cache) =>
      cache.update("vault.list", (rows) =>
        rows
          .map((e) =>
            e.id === v.id
              ? {
                  ...e,
                  title: v.title,
                  category: v.category,
                  expiresOn: v.expiresOn ? asDate(v.expiresOn) : null,
                  fieldLabels: v.fields.map((f) => f.label),
                  hasNote: !!v.note,
                }
              : e,
          )
          .sort(byTitle),
      ),
  });
  const remove = useOptimisticMutation("vault.delete", {
    lists,
    scope,
    update: (v, cache) => cache.update("vault.list", (rows) => rows.filter((e) => e.id !== v.id)),
  });
  const setVisibility = useOptimisticMutation("vault.setVisibility", {
    lists: ["vault.list"],
    scope,
    update: (v, cache) =>
      cache.update("vault.list", (rows) => rows.map((e) => (e.id === v.id ? { ...e, visibleToHousehold: v.visible } : e))),
  });

  return {
    create: (values: VaultFormValues) => create.mutate({ id: newId(), ...values }),
    update: (id: string, values: VaultFormValues) => update.mutate({ id, ...values }),
    remove: remove.mutate,
    setVisibility: setVisibility.mutate,
  };
}
