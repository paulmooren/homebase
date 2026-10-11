# Base UI is the component layer; the look stays in the app's own classes

The app hand-built the behaviour of every interactive control: pop-ups, the confirm pop-up, row menus, the colour picker, the switch, tooltips, toast messages, and a hidden-`<select>` trick for inline dropdowns, next to a handful of native selects. Each was written separately, so keyboard and screen-reader support was uneven (focus trapping, Escape, labels, announcements), and deleting still asked through the browser's own `confirm()` box. All interactive controls now sit on Base UI (the stable v1 library): it supplies the behaviour and accessibility, while appearance stays exactly as before, because Base UI is unstyled and the app's Tailwind classes and design tokens carry over to its parts (state is styled through its data attributes). The app's existing control names (`Modal`, `ConfirmDialog`, `Switch`, …) are kept as thin wrappers so most screens barely change.

We considered Radix or shadcn (a styled layer that would impose its own look, or need restyling to match), React Aria (more powerful, but a heavier, differently-shaped API for a small app), and staying hand-built (the status quo, whose accessibility gaps were the problem). Base UI fits because nothing about the look has to change, it is one tree-shakable package, and its data-attribute styling suits Tailwind v4.

## Consequences

- Date inputs stay native (Base UI has no date picker), as do file inputs and the vault note textarea (Base UI has none of these), and money-amount fields stay plain inputs (a number stepper gets in the way of typing "€1,250.50").
- Dropdowns are a styled list everywhere, so phones no longer show the native picker wheel.
- Delete confirmations always use the app's own styled alert pop-up, never the browser's.
- Toast messages go through Base UI's toast manager and are announced in a live region. Pages keep rendering a `Toast` component while the message should show, and it registers one with the manager.
- A pop-up focuses its first form field (not its close button) and an alert focuses Cancel, so each wrapper sets this explicitly.
- The page content sits in a stacking-context root so portalled pop-ups stay above it, and the body is positioned for iOS 26+ Safari backdrops.
- The migration is checked by the before/after screenshot comparison in `tests/visual` (a one-off migration check, not a permanent suite). New screens should use the shared controls instead of re-creating them.
