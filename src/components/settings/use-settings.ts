"use client";

import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/api/root";
import { trpc } from "@/trpc/react";
import { useOptimisticMutation } from "@/trpc/optimistic";

type Household = inferRouterOutputs<AppRouter>["household"]["current"];

/** Changing your own name and picture. Both show at once, here and wherever the household lists its members. */
export function useProfileActions() {
  const utils = trpc.useUtils();
  const lists = ["user.me", "household.current"] as const;
  const myId = () => utils.user.me.getData()?.id;

  /** Your entry in the household's member list takes the same change. */
  const inMembers = (household: Household, change: { name?: string; image?: string | null }): Household =>
    household
      ? { ...household, members: household.members.map((m) => (m.user.id === myId() ? { ...m, user: { ...m.user, ...change } } : m)) }
      : household;

  const updateName = useOptimisticMutation("user.updateName", {
    lists,
    scope: () => "profile",
    update: (v, cache) => {
      cache.update("user.me", (me) => ({ ...me, name: v.name }));
      cache.update("household.current", (household) => inMembers(household, { name: v.name }));
    },
  });
  const updateAvatar = useOptimisticMutation("user.updateAvatar", {
    lists,
    scope: () => "profile",
    update: (v, cache) => {
      cache.update("user.me", (me) => ({ ...me, image: v.image }));
      cache.update("household.current", (household) => inMembers(household, { image: v.image }));
    },
  });

  return { updateName: updateName.mutate, updateAvatar: updateAvatar.mutate };
}

/** Renaming the household and switching Modules on or off. The navigation follows the switch at once. */
export function useHouseholdSettingsActions() {
  const lists = ["household.current"] as const;

  const rename = useOptimisticMutation("household.rename", {
    lists,
    scope: () => "household-settings",
    update: (v, cache) => cache.update("household.current", (household) => (household ? { ...household, name: v.name } : household)),
  });
  const setModuleEnabled = useOptimisticMutation("household.setModuleEnabled", {
    lists,
    scope: () => "household-settings",
    update: (v, cache) =>
      cache.update("household.current", (household) => {
        if (!household) return household;
        const rest = household.disabledModules.filter((key) => key !== v.key);
        return { ...household, disabledModules: v.enabled ? rest : [...rest, v.key] };
      }),
  });

  return { rename: rename.mutate, setModuleEnabled: setModuleEnabled.mutate };
}
