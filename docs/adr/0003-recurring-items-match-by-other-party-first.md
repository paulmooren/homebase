# Recurring items recognise their transactions by the other party first, cleaned text second

Bank descriptions change every month (reference numbers, periods, invoice numbers), so matching on exact description text misses most real recurring payments. Each Recurring item instead remembers the other party's account number and name (stored on every imported transaction from now on) and falls back to the description with digits, dates and codes stripped for banks that don't provide one. Moves between two accounts the Household tracks are imported as a single Transfer rather than as an expense plus an income, and only count toward budgets when recurring. We rejected pure fuzzy-text matching (unreliable, no stable key) and asking the user to merge lookalikes by hand (the work this is meant to remove).

## Consequences

- Importing becomes idempotent: an already-present transaction is skipped and enriched, never added twice.
- Each Financial account stores its own account number so the app knows which counterparties are the Household's own.
- Yearly items can't be detected from under two years of data; they are added by hand.
