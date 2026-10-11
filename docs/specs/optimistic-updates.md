# Spec: Changes show up instantly, before the server has answered

> Draft, not published to an issue tracker (none is configured for this project). Intended label once published: `ready-for-agent`.

## Problem Statement

Homebase feels slow. When a Member adds a task, deletes a shopping list, ticks off a reminder or changes a transaction's Category, nothing changes on screen until the server has answered, and then the app asks the server again for the whole list before it redraws. That is two round trips in a row before the Member sees what they just did. Only a few actions (ticking and adding shopping items, reordering Budget group rows) show their result at once today, and each of those was written by hand, so the behaviour differs from place to place. The data lives in the United States and the Member is in Europe, so every round trip is noticeably long.

## Solution

Every change whose result the app can predict shows on screen immediately, then is saved in the background. If the server refuses the change, the screen goes back to how it was and a message says so ("Couldn't save, change undone"). One shared mechanism does this everywhere, so ticking a Task, deleting a Shopping list or renaming a Budget group all behave the same way. Changes the server has to work out (importing a CSV, detecting Recurring items, generating an invite code, encrypting a vault entry) keep waiting for the server, with a clear loading state. Data the app has just loaded is treated as fresh for 30 seconds, so going back to a page shows it at once and updates it quietly.

## User Stories

1. As a Member, I want a Task I add to appear in the list the moment I press Add, so that adding feels instant.
2. As a Member, I want to tick a Task, un-tick it, rename it, change its priority or assignee, or delete it and see the result at once, so that the list keeps up with me.
3. As a Member, I want a Task I just added to be usable immediately (tick it, rename it, delete it) without waiting for the server, so that quick sequences of actions just work.
4. As a Member, I want a Shopping list I delete to disappear at once and the next list to be selected, so that deleting is not followed by a pause.
5. As a Member, I want a Shopping list I create or rename to show its new state at once, so that I can add items to it straight away.
6. As a Member in a shop, I want ticking, adding, editing and removing Shopping items and favourites to be instant, so that I never wait with the phone in my hand.
7. As a Member, I want Reminders I add, edit, complete, un-complete (Undo) or delete to update at once, so that my day's list is always current.
8. As a Member, I want a Transaction I edit, delete, or assign a Category to (including "apply to all from this merchant") to show the new state at once, so that cleaning up many transactions is fast.
9. As a Member, I want Financial accounts I update or delete to change on screen at once, so that account screens never lag behind my actions.
10. As a Member, I want Categories and Budget groups I create, rename, recolour or delete to show at once, so that organising them is fluid.
11. As a Member, I want Category Budgets I set or remove to update at once, and their Visibility toggle to flip at once, so that budgeting feels immediate.
12. As a Member, I want Recurring items I edit, reorder, move between Budget groups, exclude a Payment from, or delete to update at once, so that the Budget view responds as I work.
13. As a Member, I want to accept a proposed Budgeted amount, or keep the current one, and see the figure update immediately, so that approving feels instant (ADR 0004 still applies: a Budgeted amount changes only with my approval).
14. As a Member, I want Wishlist items I add, edit, mark received, claim, un-claim, delete or change the Visibility of to update at once, so that wishlists feel as quick as lists.
15. As a Member, I want Vault entries I create, edit, delete or change the Visibility of to update at once, while revealing a secret still waits for the server, so that nothing sensitive is faked.
16. As a Member, I want Household changes (renaming it, switching a Module on or off) to take effect at once, so that the navigation changes as soon as I flip the switch.
17. As a Member, I want my profile changes (name, avatar) to show at once, so that I see them reflected immediately.
18. As a Member, I want a change the server refuses to be undone on screen with a message "Couldn't save, change undone", so that I never think something was saved when it wasn't.
19. As a Member, I want that message to appear in the same place and look as the app's other messages, so that it feels like part of the app.
20. As a Member, I want a delete I confirm in the app's alert pop-up to take effect on screen at once, with the item returning and a message if the server refuses, so that deleting is fast and still safe.
21. As a Member, I want to change the same item twice in quick succession (add a Task then tick it) and end up with exactly what I did, so that quick actions never conflict or get lost.
22. As a Member, I want changes to different items to be saved at the same time, so that many quick actions don't queue behind each other.
23. As a Member, I want the screen to quietly match the server once my changes are saved, so that figures, ordering and my partner's changes still show up correctly.
24. As a Member, I want that quiet update to leave what I'm typing or looking at undisturbed, so that nothing jumps under my finger.
25. As a Member, I want going back to a page I just visited to show its content immediately and refresh in the background, so that moving around the app is fast.
26. As a Member, I want my partner's changes to appear when I come back to the tab or after the data has been on screen for 30 seconds, so that shared lists stay current without manual refresh.
27. As a Member, I want importing a CSV, detecting Recurring items, regenerating a household invite, creating an account and revealing a vault secret to show a clear loading state until the server answers, so that results I can't predict are never guessed.
28. As a Member with a bad connection, I want a change that cannot be saved to be undone with a message instead of silently disappearing or leaving the screen wrong, so that I always know where I stand.
29. As a Member using a screen reader, I want the failure message to be announced, so that I find out a change was undone.
30. As a Member, I want everything to look exactly as it does now, so that the only difference I notice is speed.
31. As the developer, I want one shared mechanism for making a change optimistic, so that new features get instant behaviour by default and mistakes are fixed once.
32. As the developer, I want the existing hand-written optimistic updates replaced by that mechanism, so that there is one way of doing it.
33. As the developer, I want a clear list of which actions are optimistic and which deliberately are not, so that nobody has to guess.

## Implementation Decisions

- **Which actions are optimistic.** Every mutation whose result is predictable from its input: create, rename, update, delete, tick, complete and undo, reorder, move, assign Category, set Visibility, switch a Module on or off, claim, mark received. **Not optimistic**, waiting for the server with a visible loading state: CSV import and removing all transactions, Recurring-item suggestion detection and accepting suggestions in bulk, regenerating a Household invite, joining a Household, creating a Financial account that needs server-computed values, revealing a Vault secret, changing a password, push-notification subscribe, unsubscribe and test, and the Demo reset.
- **One shared mechanism.** A single helper wraps a mutation and does, in order: cancel in-flight refetches of the affected lists, take a snapshot, apply the predicted change to the cached lists, and on failure restore the snapshot and show the "Couldn't save, change undone" message. Each call site only describes how its change alters the cached lists. The helper replaces the hand-written optimistic code that exists today (shopping items and favourites, Budget group reordering).
- **Client-created ids.** Rows created optimistically get their real id on the client (`crypto.randomUUID()`) before the call is sent, and the create calls accept an optional id. The server validates the id is well formed and a duplicate is rejected. This replaces the fake `pending-` ids, so a new row can be ticked, edited or deleted at once with the id the server will know.
- **Ordering.** Changes to the same row are sent one after another (TanStack Query mutation scope keyed by row id); changes to different rows are sent in parallel.
- **After success.** The affected lists are refetched in the background, only once the last pending change for that list has finished, and only the lists that could have changed. The refetch never blocks the screen. Related cached data (for example the shopping count on the dashboard) is refreshed by the same refetch.
- **After failure.** The snapshot is restored for the affected lists, then they are refetched. The message is the existing toast, with the wording "Couldn't save, change undone". It is announced in the existing polite live region.
- **Deleting with confirmation.** The app's existing alert pop-up asks first. After confirming, the item disappears at once. Deleting the selected Shopping list selects the next list. If the server refuses, the list returns, selected again, with the message.
- **Fresh data window.** Cached data counts as fresh for 30 seconds; refetching when the window regains focus stays on. Changes the Member makes always refresh the lists they touch regardless of age.
- **No schema change.** Ids already accept client-supplied strings. No new dependency. The look of every screen is unchanged; the Base UI component layer (ADR 0006) is the rule for any new control.
- **Out-of-order safety on the server.** An update or delete for a row that does not exist (the create failed) returns the existing NOT_FOUND, which the shared mechanism treats like any failure: undo and message.

## Testing Decisions

- **One seam: what the Member sees in the browser against the Demo**, extending the existing behaviour checks (headless Chromium, keyboard and screen-reader behaviour, each check restoring what it changes). A good test asserts only what is visible, not how it is implemented.
- **Speed:** each check adds artificial latency of about 800 ms to every API call and asserts the screen has changed within a fraction of a second, before the server could have answered.
- **Failure:** a check makes a call fail on purpose and asserts the change is undone and "Couldn't save, change undone" is announced.
- **Ordering:** a check adds a Task and ticks it immediately, then reloads and asserts the final state is correct with no error.
- **Deleting a list:** a check confirms in the alert pop-up, asserts the list vanishes and selection moves on at once, and on forced failure that it returns.
- **Coverage:** at least one check per module (Tasks, Shopping, Reminders, Transactions, Financial accounts, Categories and Budget groups, Budgets, Recurring items, Wishlist, Vault, Household settings).
- **Not-optimistic actions** are checked to still show a loading state and not fake a result.
- **Looks unchanged:** the existing before/after screenshot comparison is re-run on the screens touched.
- **No unit tests** for the shared helper; it is thin glue and is exercised through the browser checks.
- **Prior art:** the existing behaviour checks, the screenshot comparison harness, and the hand-written shopping and Budget group reorder updates the helper replaces.

## Out of Scope

- Moving the database and server to a European region, a separate plan.
- Removing the household lookup done on each call, loading pages' data on the server before they appear, loading skeletons and the Prisma driver change: a separate follow-up.
- Offline use or queueing changes while the device is offline; a failed change is simply undone.
- Realtime updates from a partner's device; their changes still arrive on refetch.
- Any visual change.

## Further Notes

- Measured against the Demo the latency on the Member's laptop is dominated by the trip to the database in the United States, so the speed-up is most dramatic on a slow connection or far from the data. The region move will reduce the remaining latency of the background saves.
- ADR candidate once built: "Changes show first, then save; results the server must work out wait." Written only if the Member wants it.
- Open point for the implementer: a few mutations affect more than one cached list (for example deleting a Shopping list changes both the lists and the dashboard counts); the helper must let a call site name every list it touches.
