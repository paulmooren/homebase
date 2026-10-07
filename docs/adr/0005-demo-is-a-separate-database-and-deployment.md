# The Demo is a separate database and deployment, never a household in the real one

Showing the app to other people means showing a Household full of made-up data. The app could technically hold a demo Household next to the real one, since everything is scoped to a Household, but then one mis-scoped query would put the real finances on a stranger's screen — and the real and development databases are already the same one (a reset once wiped it). So the Demo gets its own database (created from the schema only, never from real rows), its own deployment of the same code at its own address, and its own secrets (vault key, sign-in secret). A demo mode switched on by environment shows a "made-up data" marker, offers one-click sign-in as either of two people, hides Google sign-in and sign-up, blocks account deletion and password change, and offers a "Reset demo" action that re-creates all the data with dates relative to today. We rejected a demo Household in the real database (leak risk) and a local-only demo (it depends on one laptop being set up correctly, which is how real data ends up on screen).

## Consequences

- Every schema change has to be applied to the Demo's database as well as the real one.
- The Demo cannot have its own scheduled reset: the hosting plan allows two scheduled jobs per project and the real app already uses both, so reset is on demand.
- The seed data lives in the repository and is generated relative to today, so re-seeding is always safe and the Demo always looks current.
