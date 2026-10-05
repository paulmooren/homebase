import { createTRPCRouter } from "@/server/api/trpc";
import { accountRouter } from "@/server/api/routers/account";
import { categoryRouter } from "@/server/api/routers/category";
import { transactionRouter } from "@/server/api/routers/transaction";
import { budgetRouter } from "@/server/api/routers/budget";
import { dashboardRouter } from "@/server/api/routers/dashboard";
import { userRouter } from "@/server/api/routers/user";
import { recurringRouter } from "@/server/api/routers/recurring";
import { householdRouter } from "@/server/api/routers/household";
import { taskRouter } from "@/server/api/routers/task";
import { shoppingRouter } from "@/server/api/routers/shopping";
import { wishlistRouter } from "@/server/api/routers/wishlist";

export const appRouter = createTRPCRouter({
  account: accountRouter,
  category: categoryRouter,
  transaction: transactionRouter,
  budget: budgetRouter,
  dashboard: dashboardRouter,
  user: userRouter,
  recurring: recurringRouter,
  household: householdRouter,
  task: taskRouter,
  shopping: shoppingRouter,
  wishlist: wishlistRouter,
});

export type AppRouter = typeof appRouter;
