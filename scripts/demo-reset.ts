/**
 * Puts the Demo back to its made-up starting state: `npm run demo:reset`.
 * Reads the Demo's own settings from .env.demo (see docs/adr/0005), and only
 * ever replaces the household of the two demo people.
 */
import { prisma } from "@/lib/prisma";
import { isDemoServer } from "@/lib/demo";
import { seedDemo } from "@/server/demo/seed";

async function main() {
  if (!isDemoServer()) {
    throw new Error("DEMO_MODE isn't set. Run this through `npm run demo:reset`, which loads .env.demo.");
  }
  const host = new URL(process.env.DATABASE_URL ?? "postgresql://unset/").host;
  console.log(`Re-creating the demo household in ${host} …`);
  const result = await seedDemo(prisma);
  console.log(`Done: ${result.transactions} transactions, ${result.recurringItems} recurring items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
