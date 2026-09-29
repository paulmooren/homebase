# Kontor

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
