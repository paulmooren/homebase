# Homebase — project status

A household management app: personal + shared finances, household tasks
and maintenance reminders, with recipes planned for later. Currently a
multi-person
household layer sits on top of what was originally a single-user personal
finance app. Built with Claude Code. This file exists so a fresh session
(new machine, new Claude account, or just a new conversation) can pick up
without re-deriving context.

## Product direction (as of 2026-09-28)

The app is pivoting from "single-user personal finance" to "household
management for a multi-person household (couples first, but any size)":
personal + shared finances, household tasks, yearly house-maintenance
reminders, food recipes, with a dashboard surfacing everything time-
sensitive. This is being built in phases — **household/multi-user
foundation**, **Budgeting-page rework**, a **light design-system redesign**,
**CSV per-row category assignment**, a first **dashboard reminder**
("upload last month's bank statement"), **PWA installability**, a sidebar
redesign, and **Tasks** (household tasks + yearly maintenance reminders,
unified into one model) shipped (see below). Next up: push notifications
(needs the app to actually be deployed first — see "Known limitations"),
more dashboard reminder types, recipes. Maintenance reminders specifically
are now covered by Tasks' recurrence field rather than a separate domain.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS v4
- tRPC (`src/server/api`) + React Query on the client (`src/trpc/react.tsx`)
- Prisma 6 + Postgres, hosted on Neon (project linked via `neon link` — see
  `.neon` and `neon.ts`). **Do not upgrade to Prisma 7**: its CLI is a
  cloud-platform-only redesign (`prisma deploy`/`prisma project`, no more
  `migrate dev`), incompatible with this self-hosted workflow.
- Auth.js v5, self-hosted (not Clerk/Supabase Auth — deliberate choice to
  keep identity out of a third-party vendor), magic-link only via Resend.
  Database session strategy (required for the email provider).
- Design: **light theme** (switched 2026-09-28 from the original dark
  theme — see "Design system" below), Instrument Sans (UI chrome) +
  Instrument Serif (large numbers/headings only), near-black/white/gray
  monochrome palette with color reserved for status (`src/app/globals.css`),
  EUR currency, en-GB number/date formatting (`€1,234.56`, `25/09/2026`).

## Design system

Redesigned 2026-09-28 to match [Acctual](https://mobbin.com/screens/1c19dc36-8286-4e11-b1d3-c59d5f396c59)
(a small-business invoicing app), reviewed via the Mobbin MCP plus direct
screenshots. Light background, near-white cards, black/gray monochrome UI
chrome, color reserved for status (green success, red overdue/critical),
solid black pill primary buttons, thin 1px borders. Instrument Serif is
kept only for large numbers and headings (net worth figure, page greetings,
the "K" logo) as the one remaining brand touch — everything else is sans.
Editing stays inline (no slide-over panels or new tabs were introduced;
this was a visual re-skin, not an interaction-pattern change).

Almost the entire app re-themes automatically through ~19 CSS custom
properties in `src/app/globals.css` (consumed via Tailwind v4's `@theme
inline`) — no per-page edits needed. A handful of places bypass the token
system and were updated explicitly: `app-shell.tsx`'s nav rail/bottom-bar
(hardcoded rgba, not tokens), the "K" logo mark (was a red gradient, now
solid black, in 4 files), `net-worth-card.tsx`'s chart (hardcoded hex SVG
colors), and `src/lib/email.ts`'s magic-link sign-in email (a fully
self-contained HTML string with inline styles — easy to forget since it's
not rendered anywhere in the app UI, but was still hardcoded to the old
dark palette end-to-end). If any future work adds hardcoded colors instead
of using the CSS tokens, it'll need the same manual treatment — prefer the
`bg-surface`/`text-text-muted`/`border-border-soft`/etc. token classes
everywhere possible instead.

A pre-existing mobile-viewport (375px) layout bug on the Accounts page
(long account names wrapping and overlapping the balance/buttons) was
found during this pass and fixed separately (`truncate` added to the
account name in `AccountRow`).

## Features shipped

- **Household foundation**: every user belongs to exactly one `Household`
  (`HouseholdMember`, one row per user, `userId @unique`). A brand-new
  sign-in with no household is redirected to `/household-setup`
  (`src/app/(app)/layout.tsx`'s server-side gate) to either create a
  household (seeds the default categories under it) or join one via a
  reusable invite code (`HouseholdInvite`, regenerate-to-revoke, no expiry —
  `src/server/api/routers/household.ts`). Personal-vs-shared is a
  **per-account** split: `FinancialAccount.ownerId` is nullable (`null` =
  shared/joint); everything else (`Category`, `Transaction`, `Budget`,
  `RecurringItem`, `NetWorthSnapshot`) is fully household-shared, no
  per-item ownership yet. Net worth and budget "spent" totals are
  whole-household aggregates (sum across personal + shared accounts); the
  *account/transaction lists themselves* are visibility-filtered so a
  member only sees the shared account plus their own personal one(s), never
  a partner's personal account — see `ctx.householdId`/`householdProcedure`
  in `src/server/api/trpc.ts` and the `OR: [{ownerId:null},{ownerId:ctx.userId}]`
  pattern repeated in `account.ts`/`transaction.ts`/`user.ts`. Settings has
  a "Household" section (rename, member list, invite link + regenerate).
  Account create/edit shows an owner picker (Me / Shared / [member]) only
  once the household has more than one member.
- **Dashboard**: net worth hero and recent transactions. No longer shows an
  Accounts card or a Budgets card — both moved into Settings/Admin (below).
  **Balance chart** is interactive: hover (or touch-drag on mobile) shows a
  tooltip with the exact date and value at that point, via a vertical guide
  line and a nearest-point lookup on pointer position. Period and sampling
  granularity are independent controls — 1M/3M/6M/1Y presets plus a
  "Custom" option revealing two native `type="date"` inputs (the app's
  existing date-entry pattern), and a separate Day/Week/Month granularity
  toggle. The chart's `<svg viewBox>` width is measured live via
  `ResizeObserver` and matched exactly to the container's pixel width, so
  `preserveAspectRatio="none"` no longer non-uniformly stretches the curve.
  Extracted into a shared, reusable **`src/components/balance-chart.tsx`**
  (`BalanceChart` — owns all chart UI state, reports the effective
  `{from, to, granularity}` to the parent via `onRangeChange`, parent runs
  its own query and hands back `{date, value}[]`) so the dashboard's Net
  Worth card (`net-worth-card.tsx`, now a thin wrapper around
  `dashboard.netWorthHistory`) and the per-account page (below, around
  `dashboard.accountHistory`) share one implementation. Backing queries
  resample the sparse `NetWorthSnapshot`/transaction-ledger data onto a
  *regular* date grid via forward-fill (last known value at/before each
  bucket — a balance, not a flow, so no averaging) — this also fixed a real
  bug where points used to be spaced evenly by *index* rather than by
  actual date gaps. Found a second real bug while building this: the
  client computed "today" from *local* midnight while the server always
  used *UTC* midnight (`todayUTC()`) — in any timezone ahead of UTC the
  client's day boundary lands before the server's, silently excluding
  today's own data point (invisible with older data to pad the chart,
  fatal — "No history yet" — when today's snapshot was the only one).
  Fixed by computing "today" from UTC components in `balance-chart.tsx`.
- **Per-account detail page** (`src/app/(app)/accounts/[id]/page.tsx` — the
  app's first dynamic route): reached by clicking an account row in
  Settings → Accounts. Shows that account's own current balance, its own
  `BalanceChart` (via `dashboard.accountHistory`, same forward-fill
  approach as net worth but tracking one account's ledger — both legs of a
  transfer, not just the source), and its own transaction list (reusing
  `CategoryCell` exported from `transactions/page.tsx`) with category
  editing and delete. A transfer row reads from *this account's*
  perspective — "Transfer to X" (red, this account is the source) or
  "Transfer from Y" (green, this account is the destination). Required
  fixing `transaction.list`'s `accountId` filter, which only ever matched
  the source leg (`{accountId}`) — an incoming transfer never showed up
  when filtering by the destination account; now `OR: [{accountId},
  {transferToAccountId}]` when a specific account is requested.
- **Net worth / account balance — starting-balance model**
  (`src/server/api/net-worth.ts`, `FinancialAccount.startingBalance`): a
  `FinancialAccount.balance` used to be *both* the number entered at account
  creation *and* a field incrementally bumped by `{ increment: delta } }` on
  every transaction mutation — which double-counts the moment historical
  transactions get imported on top of an already-current balance (this is
  what took a real household's net worth to −€20,883.80 after a 494-row CSV
  import). Fixed by adding a real `startingBalance` column (entered once,
  editable later in Settings → Accounts) and making `balance` a fully
  *derived* value: `recomputeNetWorthSnapshot` walks every transaction
  forward from `startingBalance` in date order, recording one
  whole-household `NetWorthSnapshot` per distinct transaction date (so the
  history graph reflects real activity, not just "today") and writing back
  each account's final running total as its `balance` — same function, same
  full-rebuild-on-every-call approach, now anchored on a real persisted
  starting point instead of back-solving one from a value that could
  already be wrong. `transaction.ts`'s create/delete/removeAll/importCsv no
  longer touch `balance` directly at all — they just call
  `recomputeNetWorthSnapshot` afterward (already did), which now handles
  both the account balance and the history in one pass. `accountDelta` is
  exported from `net-worth.ts` (single shared implementation).
- **Accounts**: full CRUD, now a section on Settings/Admin (see below) —
  not its own nav item or page. Types: checking, savings, credit card, cash,
  investment, loan, mortgage. Liability accounts store balance as a positive
  "amount owed" — see the sign-flip logic in `accountDelta` above, which
  took a real bug fix to get right (a charge on a credit card must
  *increase* what's owed, a transfer paying it down must *decrease* it).
- **Transactions**: manual entry (expense/income/transfer) + CSV import with
  an auto-detecting column mapper (`src/lib/csv.ts` — handles German
  `24.09.2026`/`1.234,56` and ISO formats). Real bug found and fixed via a
  real household's data: a row was silently dropped from import whenever its
  description/merchant column was blank (`r.merchant` falsy on an empty
  string) — some banks (bunq confirmed) leave that column empty for internal
  transfers and only populate a separate payer/payee "Name" column. Cost 69
  of 563 rows on one real import (35 income, 34 expense — disproportionate,
  since large lump-sum transfers were more likely to have a blank
  description), skewing net worth by tens of thousands with zero warning.
  Fixed in `CsvImportForm` (`transactions/page.tsx`): merchant now falls back
  through primary column → a guessed name/counterparty/payee column → the
  literal string `"Transaction"`, so a row is never dropped just for lacking
  a label; a row is only ever excluded for a genuinely unparseable date or
  amount, and that count is now shown in the UI (previously silent) so this
  class of bug can't hide again. Also: keyword-based auto-categorization
  (`src/lib/categorize.ts`, reused directly client-side now — pure/framework-
  agnostic), and **per-row category assignment**: the full parsed row list
  (not just a 5-row preview) shows an editable category dropdown per row,
  pre-filled with the auto-suggestion, with a live count of how many rows
  were categorized automatically before the user commits the import.
  Transfers are excluded from budget/income-expense totals by design. The
  list itself (flat table, matching the Tasks-page conventions: no rounded
  row hover, no header divider line, columns left-aligned) has a leading
  category-color bar per row (same visual as Budgeting's rows), a
  click-to-edit **Category** column (native-select-over-label pattern,
  `CategoryCell` in `transactions/page.tsx`) so categorizing after the fact
  doesn't require re-import, and a **Remove all** action
  (`transaction.removeAll`) that reverses every transaction's balance effect
  and deletes them all in one confirmed, atomic operation — mirrors the
  per-row `delete` logic but batches balance deltas per account first.
  `transaction.update` (categoryId only, blocked for transfers) backs the
  inline edit.
- **Budgeting** (nav label; route is still `/recurring`, only the label
  changed — see naming note below): two-column (Income / Expenses)
  table-like UI — add inline (click "+" at the bottom of a column, or the
  pencil icon on an existing row), no modal. Items can be added by hand or
  confirmed from auto-detected suggestions (`src/lib/recurring.ts` —
  matches same merchant name + consistent amount + consistent day-gap
  across ≥2 transactions; heuristic, not ML; a suggestion's owner defaults
  to the source account's owner). Monthly-equivalent totals normalize
  weekly/yearly amounts for comparison. **Per-member split**:
  `RecurringItem.ownerId` (nullable, null = shared) groups items by person
  within each column, plus a summary strip of per-member/shared monthly
  income+expense cards at the top — but **only once the household has more
  than one member**; a solo household still sees the original flat
  single-figure layout, unchanged. **Visibility is full-transparency by
  default** (household members see each other's personal items, for joint
  budgeting) **with a personal opt-out** — `User.shareRecurringItems`
  (default `true`), toggled in Settings → Privacy. Shared items and your
  own are always visible to you regardless of anyone's toggle. Mutation
  rights (edit/delete) are narrower than visibility: you can only ever
  mutate a shared item or your own, never another member's personal item
  even if they've shared it for viewing (enforced server-side in
  `src/server/api/routers/recurring.ts`, returns 404).
- **Budgets** (category monthly spend limits — a different feature from
  "Budgeting" above, which is income/expense tracking; the two pages used
  to collide on the name "Budgets" before an earlier rename): monthly,
  recurring by default, no rollover, household-wide (not per-member).
  Status thresholds: good <90%, warn 90–100%, critical >100%
  (`src/server/api/routers/budget.ts`). No longer its own nav item/page —
  now a "Budgets · {month}" section on Settings/Admin (below); heading
  renamed from "Categories · {month}" to avoid duplicating the section
  name of the actual category-list CRUD, which is a separate section on
  the same page.
- **Settings/Admin** (`/settings`): profile name; **Accounts**
  (full CRUD, moved here from its own nav item/page — starting-balance
  field, see above); **Categories** (add/rename/recolor/delete,
  household-shared); **Budgets** (per-category monthly limits, moved here
  from its own nav item/page, see above); household (see above); Privacy
  (the `shareRecurringItems` toggle described above); data export (CSV
  transactions / JSON everything); sign-out. Main nav is now just
  Dashboard, Transactions, Budgeting, Tasks, plus the "Admin" link at the
  bottom — Accounts and (Categories/)Budgets no longer appear there.
- **Onboarding**: 3-step wizard (first account → first transaction → first
  budget) shown only when a user has zero *visible* accounts, which still
  works correctly for a second household member joining an existing
  household (they already see the shared account, so the wizard doesn't
  re-trigger); persists through all steps even as data changes mid-wizard
  (see `showWizard` state handling in `src/app/(app)/dashboard/page.tsx`).
- **Dashboard reminders**: first reminder type is "upload last month's
  bank statement" — for each account visible to the caller that existed
  before this month and has zero transactions (as either leg — `accountId`
  or `transferToAccountId`) dated in the immediately preceding calendar
  month, a full-width amber alert banner (warning icon, bold lead-in +
  muted detail text, solid "Import statement" button — restyled to read as
  a system alert rather than a card, one banner per affected account)
  appears at the very top of the dashboard (above Net Worth) linking
  straight into `/transactions?import=<accountId>`, which pre-opens
  CSV-import mode with that account pre-selected
  (`src/server/api/routers/dashboard.ts`'s `reminders` procedure,
  `src/components/dashboard/reminders-card.tsx`). Purely computed from
  live data on every load (re-evaluates the same "no transactions dated
  last month" check each time) rather than a stored dismissed/seen flag —
  so it starts appearing whenever the calendar rolls into a new month with
  last month uncovered, and stops the moment a transaction dated last
  month exists, with no extra state to keep in sync. No schema change —
  inferred entirely from existing `Transaction` rows, so a manually-entered
  transaction resolves the reminder just as well as a CSV import. The
  reminder list is typed with a `type` discriminant
  (`"missing_statement"`) so future reminder kinds can share the same card
  without restructuring. No dismiss/snooze — it only disappears once the
  month has real activity.
- **PWA installability**: `src/app/manifest.ts` (name/icons/theme —
  reuses the exact `--bg`/`--accent` hex values from the design-system
  redesign), `src/app/icon.tsx` + `apple-icon.tsx` (generated via
  `ImageResponse` from `next/og`, not external image tools — a solid
  `#18181b` rounded square with a bold white "K", deliberately simpler
  than the in-app italic-serif mark since `ImageResponse`'s default font
  doesn't support italics without embedding a font file), three more
  `ImageResponse` route handlers for the manifest's 192/512/maskable
  icons, a `viewport` export for `themeColor` (the current API in this
  Next version — `metadata.themeColor` is deprecated), and a minimal
  `public/sw.js` (install/activate + a pass-through fetch handler, no
  caching strategy) registered from the root layout. **Found and fixed a
  real bug while verifying this**: `src/proxy.ts` (this Next version
  renamed `middleware.ts` → `proxy.ts`) redirects every unauthenticated
  request to `/signin` except a short exclusion list that didn't include
  the new manifest/icon/service-worker routes — they were silently
  returning the sign-in page's HTML instead of their real content. Fixed
  by extending the matcher. No push notifications yet — see below.
- **Sidebar redesign**: the desktop nav (`src/components/app-shell.tsx`)
  switched from a narrow (92px) centered icon-over-label rail to a wider
  (240px) left-aligned icon-and-label-side-by-side sidebar, matching the
  Acctual reference more closely. The bottom "Settings" link is now plain
  text with no icon, renamed to **"Admin"** — the page eyebrow follows
  automatically since both are driven from the same `NAV_ITEMS`/fallback
  list. The mobile bottom tab bar was deliberately left unchanged (still
  icon-above-label, still labeled "More") — a different, appropriately
  mobile-specific pattern, not what the reference screenshot showed.
- **Tasks**: household tasks and yearly maintenance reminders, unified
  into one `Task` model (`prisma/schema.prisma`) rather than two separate
  domains — recurrence is just an optional field
  (`RecurringFrequency | null`, reusing the same enum as `RecurringItem`).
  New `/tasks` page (`src/app/(app)/tasks/page.tsx`), same inline-add/
  edit-row interaction pattern as the Budgeting page, no modals. **Full
  transparency, not account-style privacy**: every household member sees
  every task regardless of assignee — deliberately different from how
  `FinancialAccount` visibility works, since there's no privacy need for
  "who's taking the bins out," unlike financial data. `ownerId` is purely
  an organizational "who's responsible" label; **any household member can
  complete/edit/delete any task**, not just the assignee — also a
  deliberate departure from `RecurringItem`'s narrower-mutation-than-
  visibility precedent, since task assignment isn't an ownership claim the
  way personal financial data is. Completing a **recurring** task doesn't
  produce a terminal "done" state — it sets `completedAt` and advances
  `dueDate` via the existing `nextOccurrence()` helper
  (`src/lib/recurring.ts`, already shared with `transaction.ts` and
  `recurring.ts`), then the task simply reappears as the next upcoming
  occurrence, mirroring how `RecurringItem` already works. A **one-off**
  task's completion is just `completedAt !== null`, toggleable back to
  incomplete. Tasks are grouped client-side into Overdue/Upcoming/
  Completed — no separate "maintenance" page or model.

## Deferred (explicitly out of scope for now)

Real bank sync/open banking, investment holdings detail/performance,
multi-currency, a public REST API, email notifications, savings goals,
recurring-bill auto-*cancellation* detection, household leave/remove-member
UI, household roles/permissions, household deletion, invite expiry. Also
not yet built (see "Product direction" above): push notifications,
more dashboard reminder types, recipes. Also deferred within Tasks itself
(not built in this first pass): task categories/priority, subtasks, a
calendar view.

## Environment / running it

Env vars live in `.env` (Prisma reads this) and `.env.local` (Neon-managed,
also read by Next.js — keep both in sync if you ever re-link the Neon
project). Needed: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`,
`NEXTAUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.

```bash
npm run dev     # http://localhost:3000
npm run build   # type-checks + production build
npx prisma migrate dev --name <description>   # after schema.prisma changes
```

`scripts/dev-login.mjs` seeds a session directly via Prisma (bypasses
Resend) for local testing without sending real email — it's a dev-only
backdoor, meant to stay dev-only rather than be deleted. It's now
household-aware: `node scripts/dev-login.mjs personA@test.local` then
`node scripts/dev-login.mjs personB@test.local <invite code from A's
Settings page>` sets up a two-person household locally without needing
Resend. `scripts/backfill-households.mjs` was a one-off migration script
(already run against the real database) that gave every pre-existing user
their own household with their existing accounts marked personal (not
shared) — kept in the repo as a record of what the migration did, not
meant to be re-run.

## Known limitations / open items

- **Resend is in sandbox mode**: it can only send to the address the Resend
  account was signed up with (currently `moorenpaul@gmail.com`). Real
  sign-up by other users needs a verified domain at resend.com/domains plus
  updating `EMAIL_FROM` in `.env`.
- **Git isn't initialized yet.** Everything so far exists only as files on
  disk — see the note below if you're reading this because you're about to
  switch machines/accounts.
- **No deployment yet** — the app only runs via `npm run dev` locally, no
  hosting is set up. This blocks push notifications specifically: sending
  a scheduled push (e.g. the monthly-statement reminder as an actual
  notification, not just a dashboard card) needs a real, always-reachable
  server to run the send on a schedule. Deploy first, then push
  notifications become buildable end-to-end.
- CSV import has now been click-tested end-to-end, including the file
  picker: native `<input type="file">` can't be driven by clicking, but
  assigning a `File` via a `DataTransfer` object and dispatching a
  `change` event on the input works around it (browser automation only —
  not a code change) for future verification passes.
- The real user account is `moorenpaul@gmail.com` (has real data: an
  account, transactions, recurring items). The household migration gave
  this user their own household (auto-created by the backfill script) with
  their existing account marked personal, not shared. Any account seen with
  email `paul.mooren@sdui.de` in the database was test data created via
  `dev-login.mjs` and has been cleaned up after each test pass — don't be
  surprised if it reappears during future testing and gets deleted again
  the same way.
- The two-person household flow (create → invite → join → visibility
  filtering) has been click-tested end-to-end in a browser with two real
  test sessions: household creation, invite-code join, personal vs. shared
  account visibility in both directions, and the whole-household net-worth
  aggregate all confirmed correct. One real bug was found and fixed during
  this pass: a newly created account in a still-solo household defaulted to
  `ownerId: null` (shared) because the owner picker is hidden until a second
  member exists — meaning it would have silently become visible to whoever
  joined later. Fixed in `AccountForm` (`src/app/(app)/accounts/page.tsx`)
  to default to the creator (personal) instead when the picker is hidden,
  matching the same privacy-conserving default used by the migration
  backfill.

## If you're continuing this on a different Claude account / machine

The project itself (files, `.env`, the Neon-linked database) isn't tied to
any Claude account — it's plain local state, so opening this same directory
in a new session gives full access to everything automatically. What
*doesn't* carry over automatically is this conversation's memory, which is
why this file exists. Read it, then `npm run dev` and go.
