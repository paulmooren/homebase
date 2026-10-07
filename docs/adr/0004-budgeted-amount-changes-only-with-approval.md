# A Recurring item's Budgeted amount never changes without the Member's approval

Salaries rise, phone bills move by a euro, investment plans step up and down, and one bonus or refund can sit in the middle of an otherwise steady run. Each Recurring item therefore has a Basis (Latest, Lowest, Highest or Average of the last 6 Payments, or a typed Fixed amount) that turns its Payments into the Budgeted amount, and new Payments only ever *propose* a new figure: the Member approves it on the row ("Update" / "Keep"), and a notice after an import says something changed. Changes under 3% (or €1) are ignored, a one-off Payment can be set aside so it never skews the history, and a Fixed item shows a quiet hint when its Payments drift instead of proposing anything. We rejected silently re-applying the Basis after every import (a single odd payment would change "Left each month" with nobody noticing) and an average of recent Payments (wrong for a salary that rises).

## Consequences

- "Left each month" only moves when the Member says so, which is what makes it trustworthy as a planning number.
- Every Payment links to exactly one Recurring item, and a Payment set aside must be remembered so the next import does not link it again.
- Keeping a proposed figure is remembered per figure: the same amount is not proposed twice, a different one is.
