# Homebase

A household finance app: shared and personal accounts, transactions (manual
entry + CSV import), recurring income/expense tracking, category budgets,
net worth over time, and household tasks/reminders. Built with Next.js
(App Router), tRPC, Prisma, and Neon Postgres.

## Local development

1. Copy `.env.example` to `.env` and fill in the values (see below).
2. Install dependencies and run migrations:
   ```bash
   npm install
   npx prisma migrate deploy
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Pooled Neon Postgres connection string |
| `DATABASE_URL_UNPOOLED` | Direct (unpooled) connection string, used by Prisma migrations |
| `AUTH_SECRET` | Auth.js session secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | The app's own base URL (`http://localhost:3000` locally, your production URL when deployed) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client credentials, used for "Continue with Google" sign-in |

### Dev-only tooling

`scripts/dev-login.mjs` mints a signed session JWT directly, bypassing
Google/password sign-in, for local multi-user testing. It prints a cookie
name and value — set that cookie in your browser's devtools to sign in as
that user. It's a standalone script (not part of the deployed app — nothing
under `src/` imports it), so it can't be triggered over HTTP, but it does
need direct database access (to create the user) and `AUTH_SECRET` (to sign
the session the same way the app would): never run it against a production
`DATABASE_URL`.

## Deploying

This app deploys cleanly to [Vercel](https://vercel.com) with a [Neon](https://neon.tech)
Postgres database (no code changes needed — it's already built against both):

1. Push this repo to GitHub.
2. In Vercel, "Add New Project" → import the GitHub repo.
3. Add the environment variables above in the Vercel project settings
   (use your production Neon connection strings and Resend key — a separate
   Neon branch/project for production, kept apart from local dev data, is
   recommended).
4. Set `NEXTAUTH_URL` to the production URL Vercel gives the project.
5. Deploy. Every future push to the main branch auto-deploys.

After the first deploy, run `npx prisma migrate deploy` against the
production database (via `vercel env pull` locally, or a one-off Vercel
CLI/GitHub Action step) so the schema is up to date.

## The Demo

A separate copy of the app with made-up people and money (Alex and Sam), for
showing Homebase without showing a real household. It has its own database, its
own secrets and its own address, and never shares anything with the real app
(see `docs/adr/0005`). It runs the same code; setting `DEMO_MODE` turns on the
"Demo — made-up data" marker, one-click sign-in as Alex or Sam, and a "Reset
demo" button (Settings → Data), and hides sign-up, Google sign-in, password
change and notifications.

**Locally** (everything it needs is in the git-ignored `.env.demo`):

| Command | What it does |
| --- | --- |
| `npm run demo:dev` | Runs the Demo at <http://127.0.0.1:3100>. Use `127.0.0.1`, not `localhost`: the browser then keeps its cookies apart from the real app's. |
| `npm run demo:reset` | Re-creates the made-up household, with dates counted back from today. |
| `npm run demo:migrate` | Applies schema changes to the Demo's database. Run it after every schema change, next to the real one. |

**Hosted** (a second Vercel project from the same repo, so every push updates both):

1. Vercel → Add New Project → import this repo again, name it `homebase-demo`.
2. Environment variables, copied from `.env.demo`: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
   `AUTH_SECRET`, `VAULT_KEY`, `DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_MODE=true`. Set them
   **before** the first deploy: `NEXT_PUBLIC_DEMO_MODE` is baked into the build. Leave out
   everything else (Google, notifications, `CRON_SECRET`) — the Demo has no use for them.
3. Keep the function region at Washington, D.C. (iad1): next to the database, so a reset takes seconds.
4. Deploy, open the address, continue as Alex. The data is already there; "Reset demo" puts it back.
