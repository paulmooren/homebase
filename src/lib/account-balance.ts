import { LIABILITY_ACCOUNT_TYPES } from "@/lib/constants";

function isLiabilityType(type: string) {
  return (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(type);
}

/**
 * Signed balance delta for one leg of a transaction. A liability account's
 * `balance` stores the amount owed (a positive magnitude), which moves the
 * *opposite* way from an asset account for the same real-world event: a card
 * charge increases what you owe, a transfer that pays down a card decreases it.
 */
export function accountDelta(
  accountType: string,
  effect: "expense" | "income" | "transferOut" | "transferIn",
  amount: number,
) {
  const assetDelta = effect === "expense" || effect === "transferOut" ? -amount : amount;
  return isLiabilityType(accountType) ? -assetDelta : assetDelta;
}
