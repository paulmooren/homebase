# Spec: Move every interactive control onto Base UI, with the look unchanged

> Draft, not yet published to an issue tracker (none is configured for this project yet). Intended label once published: `ready-for-agent`.

## Problem Statement

Homebase hand-builds the behaviour of its interactive controls: its pop-up windows, menus, dropdowns, switch, checkboxes, tooltips and toast messages. Each was written separately, so keyboard and screen-reader support is uneven. Some pop-ups trap focus and some don't, some close on Escape and some don't, and not every control announces itself properly. Deleting something asks for confirmation with the browser's own plain "OK / Cancel" box, which looks nothing like the app. Dropdowns are native on some screens and a custom trick on others, so they look and behave differently from place to place. The Member (Paul) wants the app to be properly accessible and consistent without anything looking different: the same colours, spacing, type and shapes as today.

## Solution

Every interactive control moves onto Base UI, an unstyled, accessible component library (stable v1). Base UI supplies the behaviour and accessibility; the app's existing look is kept by carrying its current styling over to the Base UI parts, so each screen looks the same at rest. Deleting asks with the app's own styled alert pop-up instead of the browser's box. All dropdowns become one Select. Messages appear through Base UI's toast. The two tab-style bars that are really links between pages stay as links, marked correctly as the current page. The work is done on a separate branch, checked screen by screen against screenshots of the app as it is today, previewed by the Member on the real app, and only then merged.

## User Stories

1. As a Member who navigates with the keyboard, I want every pop-up to take focus when it opens and give it back to where I was when it closes, so that I never lose my place.
2. As a Member who navigates with the keyboard, I want Tab to stay inside an open pop-up, so that I don't tab into the page behind it.
3. As a Member, I want Escape to close any pop-up, menu or dropdown, so that closing works the same everywhere.
4. As a Member using a screen reader, I want pop-ups announced with their title, so that I know what opened.
5. As a Member using a screen reader, I want every form field to be read with its label, so that I know what to type where.
6. As a Member using a screen reader, I want an error under a field to be linked to that field, so that I hear why it was rejected.
7. As a Member, I want the page behind an open pop-up to stay put and not scroll, so that nothing moves while I'm focused on the form.
8. As a Member deleting a transaction, I want the app's own alert pop-up to ask me first, so that the question looks like part of the app and not the browser.
9. As a Member deleting a recurring item, a group, a wish, a todo, a vault entry, an account or a shopping list, I want the same styled alert pop-up every time, so that deleting always feels the same.
10. As a Member, I want the alert pop-up's primary and cancel buttons clearly distinguished, with the destructive choice not pre-selected, so that I can't delete by accident.
11. As a Member using the keyboard, I want Enter and Escape to behave predictably in the alert pop-up, so that I can confirm or cancel without the mouse.
12. As a Member on a phone, I want pop-ups to appear as a sheet from the bottom as they do today, so that nothing about how I use the app on my phone changes.
13. As a Member, I want the buttons at the bottom of a long form pop-up to stay in view while the form scrolls, as they do today.
14. As a Member opening a row's action menu, I want it to open next to the button, close when I click elsewhere, and be usable with the arrow keys, so that menus are quick and predictable.
15. As a Member using the keyboard, I want to move through menu items with the arrow keys and choose with Enter, so that I don't need the mouse.
16. As a Member picking an account, category, owner, group or schedule unit, I want every dropdown to look the same and open the same way, so that I learn it once.
17. As a Member using the keyboard, I want to open a dropdown with Enter or Space, move with the arrow keys, type a letter to jump, and pick with Enter, so that choosing is fast.
18. As a Member on a phone, I want dropdowns to open as a styled list that is easy to tap, so that choosing works comfortably on a small screen.
19. As a Member, I want the inline dropdowns in the budget rows (schedule, category, account, group) to keep their compact look, sized to their current value, so that rows don't get wider.
20. As a Member, I want the switches, such as visibility and module on/off, to be toggled with Space and announced as on or off, so that their state is clear.
21. As a Member, I want the checkboxes in the suggestions panel and filters to be real checkboxes with labels, so that they work with a keyboard and a screen reader.
22. As a Member, I want the choice of how to budget an amount (Latest, Lowest, Highest, Average, Fixed) to be a proper group of options I can move through with the arrow keys, so that I can choose without the mouse.
23. As a Member, I want the colour picker for a category to open as a popover, close on Escape and let me pick a colour with the keyboard.
24. As a Member, I want hover tips, such as the amount on a chart bar and "Recurring · every month" on the repeat icon, to also appear when I focus the element with the keyboard, so that the same information is reachable without a mouse.
25. As a Member, I want the interval ("Every 3 months") to be a number field that I can step with the arrow keys, so that I can adjust it quickly.
26. As a Member, I want money amounts to stay plain text fields I can type "€1,250.50" into, so that entering amounts doesn't change.
27. As a Member, I want date fields to stay the browser's own date pickers, so that picking dates works as it does now.
28. As a Member, I want toast messages ("Added to recurring expenses", "Imported 12 new, updated 3 existing") to look and behave as today, including their action buttons, and to be announced to a screen reader.
29. As a Member, I want a toast to go away on its own and be dismissible, so that it never stays in the way.
30. As a Member, I want the Finance and Settings tab bars to keep working as links between pages, with the current page marked for screen readers.
31. As a Member, I want avatars to show the person's picture or their initial exactly as they do today, including when a picture fails to load.
32. As a Member, I want every button, from the big primary ones to the small icon-only ones, to keep its look, and to show a clear outline when I reach it with the keyboard.
33. As a Member, I want disabled buttons to look the same and stay unreachable, and a button that is busy ("Importing…") to behave the same.
34. As a Member, I want drag-and-drop ordering of recurring items to keep working exactly as now, so that the migration doesn't break it.
35. As a Member, I want the click-to-edit fields (names, amounts) to keep their feel, with no layout shift when I start editing.
36. As a Member, I want the sign-in, onboarding and household setup screens to look identical, so that the first thing I see is unchanged.
37. As a Member, I want the demo (the made-up household) to look and behave the same as the real app, so that what I show people is the real thing.
38. As a Member showing the app to others on the demo, I want nothing to look different between the demo and the live app.
39. As a Member, I want to see the migrated app on a preview of the real app before it goes live, so that I can try it with my own data and say whether it is right.
40. As a Member, I want to be able to go back to how the app was before, so that a problem found later can be undone quickly.
41. As a developer, I want one shared set of control components that carry the app's styling, so that a new screen gets accessible, consistent controls without re-creating them.
42. As a developer, I want the choice of Base UI recorded with the reasons and the alternatives considered, so that nobody has to ask why not Radix or shadcn later.
43. As a Member on a slow phone connection, I want the migration not to make pages noticeably heavier, so that the app stays quick.

## Implementation Decisions

- **Library:** adopt Base UI (the stable v1 package, one package with tree-shakable parts). It supplies behaviour and accessibility only; all appearance stays with the app's Tailwind styling and design tokens, which are unchanged.
- **Setup the library requires:** wrap the app's content in a stacking-context root so pop-ups appear above the page, and adjust the page body for the iOS 26+ Safari backdrop behaviour, as the library's documentation describes.
- **A shared control layer:** a single set of control components that wrap the Base UI parts and carry the app's current classes, so a control looks identical by construction. Existing control names and props (Modal, Switch, Avatar and so on) are kept so that most screens change little or nothing. Base UI's state attributes (open, checked, disabled, highlighted) replace the hand-written state classes.
- **Mapping, widgets:** pop-up window → Dialog; confirm dialog and every browser confirmation → Alert Dialog; row action menus → Menu; category colour picker → Popover; switches → Switch; checkboxes → Checkbox; the budgeting-basis choice → Radio Group; hover tips → Tooltip (also shown on keyboard focus); avatars → Avatar with a fallback initial; toast messages → Toast.
- **Mapping, form controls:** every native dropdown and the hidden-select trick used for inline dropdowns → Select, the inline variant keeping its compact, sized-to-value look; the interval count → Number Field; text inputs → Input, labelled and described through Field so that labels, hints and errors are linked; every button → Button.
- **Delete confirmations:** all eleven uses of the browser's confirm box are replaced by the app's styled alert pop-up, through one shared confirm helper so that call sites stay small. This is the one deliberate visual change, requested by the Member: the app's own alert pop-up, never the browser's.
- **Toast:** moves from a conditionally rendered component to Base UI's manager-style Toast, with one provider and a small hook for showing a message with optional action buttons. The look and wording are unchanged.
- **Tab bars:** the Finance tabs and Settings tabs stay as links between pages; they gain the correct current-page marking for assistive technology. Base UI Tabs is not used, because it switches panels on one page, not routes.
- **Left native on purpose:** date inputs (Base UI has no date picker) and money-amount fields (they are typed as text such as "€1,250.50", which a number stepper would get in the way of).
- **Untouched:** the drag-and-drop ordering library and its behaviour, data and server logic, the database, the demo seed, routes and page structure.
- **Focus styling:** controls show a visible keyboard-focus outline in the app's existing accent, where today some show none. Mouse and touch appearance at rest is unchanged.
- **Rollout:** a separate branch from the current state, which is tagged as the way back; one push of that branch so a preview of the real app is built; the Member tries it and says so before it is merged. Pushes are kept to a minimum because the hosting plan is close to its storage limit.
- **Architecture record:** write ADR 0006, "Base UI is the component layer", covering why Base UI, the alternatives (Radix/shadcn, React Aria, staying hand-built), and that appearance stays in the app's own styling.
- **No glossary change:** this is a technical change and adds no domain terms.

## Testing Decisions

- **What a good test is here:** it checks what a Member can see and do, never how the components are built. It compares what is on screen and drives the app the way a person would (keyboard, clicks). It must still pass if the internals change again.
- **One seam:** the demo app in a real browser, screen by screen, using its made-up household as the fixture. No tests of individual components, and none of the server or data.
- **Visual check:** for every screen, and for each open state (pop-up open, menu open, dropdown open, delete alert, toast showing, a field in an error state), take a screenshot at a desktop width and a phone width on the starting state and again on the migrated state, and compare them. At-rest differences beyond a small tolerance are fixed; differences in animation timing and the browser's own focus outline are ignored.
- **Same-day comparison:** the demo's dates are relative to today, so before and after are captured on the same day against freshly reset demo data. This is a migration check, not a permanent regression suite, and the spec says so.
- **Behaviour checks, through the keyboard and the accessibility tree:** a pop-up takes focus, traps Tab, closes on Escape and returns focus; a dropdown opens, moves, types-ahead and selects from the keyboard; a switch toggles with Space and reports its state; a menu opens and is navigable with arrows; a delete asks via the styled alert and does nothing if cancelled, deleting only on confirm; a toast appears, is announced, and can be dismissed; each form field exposes its label; the drag handle for ordering still reorders; the tab bars mark the current page.
- **Prior art:** none in this project. It has no tests and no browser-test tooling. The migration adds one development-only browser-testing tool and keeps the check small.

## Out of Scope

- A custom date picker (Base UI has none; dates stay native).
- Making money amounts number-stepper fields.
- Replacing the drag-and-drop ordering library.
- Any visual redesign, new colours, spacing, typography or dark mode.
- Changes to data, the database, server logic, routes or the demo's seed.
- Turning the page-to-page tab bars into Base UI Tabs.
- A permanent visual-regression suite that runs on every change.
- Internationalisation or right-to-left layouts.

## Further Notes

- The hosting plan's storage meter is already over its limit, so the work is deliberately one push to one branch, not many.
- The starting state is tagged `before-base-ui` for a quick way back.
- Base UI is at v1.9 and stable (released 2026-10-09). Canary builds can carry breaking changes, so only stable releases should be used.
- The delete-confirmation change is the only intentional visible difference. Keyboard focus outlines and popup animations may also differ slightly, as a by-product of the accessible parts.
