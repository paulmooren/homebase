import { ShoppingView } from "@/components/shopping/shopping-view";
import { isModuleEnabled } from "@/lib/modules";
import { loadShoppingList } from "@/trpc/prefetch-shopping";
import { HydrateClient, loadHousehold } from "@/trpc/server";

export default async function ShoppingPage() {
  const household = await loadHousehold();
  // A Household with Shopping switched off is sent to the dashboard by the page, so there is nothing to load.
  if (isModuleEnabled(household?.disabledModules ?? [], "shopping")) await loadShoppingList("page");

  return (
    <HydrateClient>
      <ShoppingView />
    </HydrateClient>
  );
}
