import { DashboardView } from "@/components/dashboard/dashboard-view";
import { isModuleEnabled } from "@/lib/modules";
import { loadShoppingList } from "@/trpc/prefetch-shopping";
import { HydrateClient, caller, loadHousehold, loadQuery } from "@/trpc/server";

export default async function DashboardPage() {
  const household = await loadHousehold();
  const on = (key: Parameters<typeof isModuleEnabled>[1]) => isModuleEnabled(household?.disabledModules ?? [], key);

  // Everything the dashboard shows for the Modules that are on, side by side, so it arrives with the page.
  await Promise.all([
    on("finance") && [
      loadQuery("account.list", undefined, () => caller.account.list()),
      loadQuery("category.list", undefined, () => caller.category.list()),
      loadQuery("dashboard.missingStatements", undefined, () => caller.dashboard.missingStatements()),
      loadQuery("dashboard.summary", undefined, () => caller.dashboard.summary()),
    ],
    on("shopping") && loadShoppingList("dashboard"),
    on("tasks") && [
      loadQuery("task.list", undefined, () => caller.task.list()),
      loadQuery("reminder.list", undefined, () => caller.reminder.list()),
    ],
    on("vault") && loadQuery("vault.expiringSoon", undefined, () => caller.vault.expiringSoon()),
  ].flat());

  return (
    <HydrateClient>
      <DashboardView />
    </HydrateClient>
  );
}
