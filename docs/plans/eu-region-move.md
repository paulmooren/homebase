# Plan: move Homebase (and the Demo) to Europe

Status: **plan only — nothing in it has been run.** Written 2026-10-11. Every step that touches the real database,
a Vercel setting or an env var is marked **🛑 APPROVAL** — stop there and get Paul's explicit yes.

## Goal and what we're moving

| | Real app | Demo (docs/adr/0005) |
| --- | --- | --- |
| Neon project today | `ancient-credit-76461142` ("Budgeting"), `aws-us-east-2`, Postgres **18**, ~35 MB, branches `production` (primary) + `old-production` | `aged-sunset-76824218` ("homebase-demo"), `aws-us-east-2`, Postgres **18**, ~35 MB, branch `main` |
| Neon project after | new, **`aws-eu-central-1` (Frankfurt)**, Postgres 18 | new, **`aws-eu-central-1`**, Postgres 18 |
| Vercel functions today | default region (Washington D.C., `iad1`) | `iad1` (README says to keep it there) |
| Vercel functions after | `fra1` | `fra1` |

Neon cannot change a project's region, so each move is: new project → copy data → switch connection strings → retire the old project.
The Demo is **not copied**: it is rebuilt from the schema and re-seeded (ADR 0005: "created from the schema only, never from real rows").

### Why this helps (and the one way it could make things worse)

Today the function (`iad1`) and the database (Ohio) are a few ms apart; the Atlantic is crossed **once per request, between the user
and the function** (~90–110 ms round trip from Europe, plus TLS/connection setup on cold paths). Moving *both* function and DB to
Frankfurt removes that crossing and also shrinks the function↔DB hop from ~10–15 ms to ~1–2 ms per query (tRPC calls make several).

**Hard rule: never run `fra1` functions against an Ohio database** (or `iad1` functions against a Frankfurt one). Every query would then
cross the Atlantic and pages get *slower* than today. This drives the ordering below, and is the main trap with `vercel.json`:
**both Vercel projects deploy the same repo, so a `regions` entry in `vercel.json` hits both at once.** Hence the Demo goes first and is pinned
via its dashboard setting; `vercel.json` only lands at the very end (Phase 5).

## Facts this plan relies on

- Both connection strings in `.env`, `.env.local` and `.env.demo` are the same shape: `postgresql://…@ep-…c-7.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require`.
  `DATABASE_URL` is the pooled one, `DATABASE_URL_UNPOOLED` the direct one (`prisma/schema.prisma`: `url` / `directUrl`). `pg_dump`/`pg_restore`/`prisma migrate` use the **unpooled** one.
- Auth uses `session: { strategy: "jwt" }` (`src/lib/auth.ts`): sessions live in the cookie, signed with `AUTH_SECRET`. Same secret → **nobody is logged out** by the move.
- `VAULT_KEY` encrypts Vault values *before* they hit the database. Copying rows + keeping the same key = Vault still decrypts. Do not rotate it during the move.
- Nothing in the code references a DB host or region (`grep`: only `src/app/api/trpc/[trpc]/route.ts` has `maxDuration = 60`). No code changes are needed except `vercel.json`.
- Google OAuth redirect URIs, Resend, VAPID keys, `CRON_SECRET`, `NEXTAUTH_URL`: **unchanged** (the public domain doesn't change).
- Vercel Hobby = **one** function region (fine, `fra1`). Crons (`vercel.json`, 08:00 and 09:00 UTC → reminders at 10:00 Amsterdam) run as ordinary functions in that region; Hobby cron timing is ±59 min anyway.
- Neon Free: 100 projects, 20 GB total storage, 5 GB egress/project/month, 10 branches/project, **6 h** restore window, **1 manual snapshot**, scale-to-zero after 5 min (cannot be turned off). A 35 MB copy is far inside every limit. The `history_retention_seconds` on both projects is 21600 (6 h) — point-in-time restore is **not** a real backup for this move; the dump file is.
- Neon Postgres **18** on both sides → the local `pg_dump` must be **18 or newer**, and the new projects must be created as Postgres 18.
- This Mac has no `psql`/`pg_dump`/`vercel`/`neon` CLIs installed (Homebrew and Node are present).
- ⚠️ Local dev DB == live DB (see memory). `.env` / `.env.local` point at the real database. Never use a shadow-DB flag pointing at it.

## Decisions for Paul (answer before Phase 0)

1. **Maintenance window**: pick a quiet time (e.g. late evening) and tell the household. The only data-loss exposure is writes in the ~5–10 min between the final dump and the switch (Phase 4).
2. **Local dev database after the move**: keep "dev == live" (simplest, same hazard as today) or add a `dev` branch in the new project and point `.env`/`.env.local` at it (recommended, one extra step, branch is free). Not required for the move.
3. **Neon ↔ Vercel integration**: is `DATABASE_URL` on either Vercel project *managed by the Neon integration* (greyed-out/"managed" in Settings → Environment Variables)? If yes, the integration is bound to the old project and must be disconnected/re-pointed first; the plan assumes plain env vars. (Check in Phase 0.)

---

## Phase 0 — Preparation (read-only, no approvals needed except where marked)

0.1 Install matching client tools (local, harmless):

```bash
brew install postgresql@18
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"   # add to the shell you use for the whole plan
pg_dump --version   # must say 18.x
npm i -g vercel     # or use `npx vercel` each time; needed for --skip-domain / promote / env pull
```

0.2 Make a working folder **outside the repo** (dumps contain real finances; `.gitignore` only protects `.env*`):

```bash
mkdir -p ~/homebase-migration && chmod 700 ~/homebase-migration
```

0.3 Collect the facts (look in the dashboards, write nothing down in the repo):
- Vercel real project: Settings → Environment Variables — which of `DATABASE_URL`, `DATABASE_URL_UNPOOLED` exist, in which scopes (**Production / Preview / Development**), and whether they're integration-managed (decision 3). Note the deployment currently live (for rollback) and Settings → Functions → Function Region.
- Vercel Demo project (`homebase-demo`): same list; Function Region (expected `iad1`).
- Neon: who else connects to the old DBs (anything besides Vercel + this laptop? e.g. a second laptop, a saved GUI client)? Everything found here must also be re-pointed.
- Save the current URL hostnames (not passwords) of old/new in `~/homebase-migration/notes.txt` so you can tell them apart in the heat of the moment.

0.4 **Latency baseline — do this now, before anything changes**: Section "Latency check" below, saved to `~/homebase-migration/latency-before.txt`.

0.5 Create the two new Neon projects. **🛑 APPROVAL #1** (creates billable-class resources in Paul's Neon org; free tier, reversible by deleting them):
- Name `homebase-eu` / `homebase-demo-eu`, region **AWS Europe Central 1 (Frankfurt)**, **Postgres 18**, same org (`org-crimson-poetry-00929016`).
- Default branch: rename to `production` (real) / keep `main` (demo) so `.neon`/`NEON_BRANCH=production` keep making sense.
- Database `neondb` and its default owner role are fine — the dump is restored with `--no-owner --no-acl`, so role names needn't match.
- Compute settings: copy from the old projects (real: 0.25–2 CU; demo: 0.25 fixed). Scale-to-zero stays at Neon's 5 min.
- Copy the new **direct** (unpooled) and **pooled** connection strings into `~/homebase-migration/new-real.env` / `new-demo.env` (chmod 600) — never into chat, never into the repo.

## Phase 1 — Back up the real database and prove the backup works

All of Phase 1 only *reads* the live DB (pg_dump takes a consistent snapshot with a read-only transaction; it blocks nothing but schema changes). It still touches the real DB, so:

**🛑 APPROVAL #2 — run the backup against the real database.**

1.1 Dump (custom format, direct connection, **no** pooled string — pgbouncer and `pg_dump` don't mix):

```bash
cd ~/homebase-migration
set -a; . /Users/paul.mooren/Paul/.env; set +a      # for OLD_URL only; do not echo it
OLD_URL="$DATABASE_URL_UNPOOLED"
pg_dump -Fc -v --no-owner --no-acl -d "$OLD_URL" -f real-$(date +%Y%m%d-%H%M).dump
chmod 600 real-*.dump; shasum -a 256 real-*.dump | tee real-dump.sha256
```

1.2 Sanity-check the file itself (no DB involved): `pg_restore -l real-*.dump | head -50` must list every table, the `_prisma_migrations` table and sequences, with no errors.

1.3 Second, independent backup inside Neon: take the project's one free manual **snapshot** of `production` (Console → Backup & restore → Snapshots) and name it `pre-eu-move`. Cheap, but it lives in the *old* project, so it dies with it — treat it as a convenience, not the backup.

1.4 **Prove it restores** (rehearsal into the new project, on a throwaway branch so the real target stays empty):
- **🛑 APPROVAL #3** (writes only to the *new* project): in `homebase-eu`, create a branch `rehearsal` from the empty `production` branch and restore into it:

```bash
REHEARSAL_URL="<unpooled string of homebase-eu / branch rehearsal>"
time pg_restore -v --no-owner --no-acl -d "$REHEARSAL_URL" real-*.dump 2>&1 | tee restore-rehearsal.log
```

  Expected: seconds for 35 MB. Read `restore-rehearsal.log`: the only acceptable messages are harmless "already exists" notices for `public`/`plpgsql`. Anything else (missing extension, permission, type/collation errors) must be understood **now**. (The repo's migrations contain no `CREATE EXTENSION`, so none are expected.)

1.5 Verify the rehearsal copy matches the source **exactly** — row counts *and* content hashes per table. Save as `compare.sql` and run it against both databases, then diff:

```sql
-- compare.sql — per-table row count + md5 of all rows (small DB, so this is cheap)
select format('select %L as tbl, count(*) as n, md5(coalesce(string_agg(t::text, %L order by t::text), %L)) as hash from %I t',
              table_name, '|', '', table_name)
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name
\gexec
```

```bash
export PGOPTIONS="-c timezone=UTC -c datestyle=ISO,YMD -c intervalstyle=postgres"   # same text rendering on both sides
psql "$OLD_URL"        -X -A -t -f compare.sql > counts-old.txt
psql "$REHEARSAL_URL"  -X -A -t -f compare.sql > counts-rehearsal.txt
diff counts-old.txt counts-rehearsal.txt && echo IDENTICAL
```

  (`_prisma_migrations` includes `finished_at`/timestamps and is copied verbatim, so it hashes equal too. If a table differs only because the live app wrote between the two runs, re-run the pair back-to-back; do the comparison in a quiet moment.)

1.6 Verify the app's own view of the copy (read-only Prisma commands; pass the new URLs explicitly, they override `.env`):

```bash
cd /Users/paul.mooren/Paul
DATABASE_URL="$REHEARSAL_URL" DATABASE_URL_UNPOOLED="$REHEARSAL_URL" npx prisma migrate status      # "Database schema is up to date"
DATABASE_URL="$REHEARSAL_URL" DATABASE_URL_UNPOOLED="$REHEARSAL_URL" \
  npx prisma migrate diff --from-url "$REHEARSAL_URL" --to-schema-datamodel prisma/schema.prisma --exit-code   # exit 0 = no drift
```

  Never `migrate dev` / `migrate reset` / anything with `--shadow-database-url` here.

1.7 Run the app locally against the rehearsal copy (override env for that one process, `.env` untouched) and click through: sign in, Budgets, Transactions, open a Vault entry and **reveal it** (proves `VAULT_KEY` + copied ciphertext), Tasks, Settings → Notifications still lists the push subscription.

```bash
DATABASE_URL="$REHEARSAL_URL" DATABASE_URL_UNPOOLED="$REHEARSAL_URL" npm run dev -- -p 3200
```

  (Next.js loads `.env*` but real shell variables win. Use a different port so a stray tab on :3000 isn't mistaken for it. Use the **pooled** string for `DATABASE_URL` if you want to test exactly what Vercel will use.)

The backup is "tested" only when 1.2, 1.4, 1.5, 1.6, 1.7 all pass. Keep `real-*.dump` until Phase 8 is complete.

## Phase 2 — Demo first (low stakes, rehearses the Vercel mechanics)

The Demo holds only made-up data, so we rebuild instead of copy. This also exercises the env-change → redeploy → check loop before touching the real app.

2.1 **🛑 APPROVAL #4 — edit the Demo's local env and run `demo:migrate` / `demo:reset` against the *new* Demo project only.** Edit `.env.demo`: replace `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with the `homebase-demo-eu` strings (keep `AUTH_SECRET`, `VAULT_KEY`, `DEMO_MODE`, `NEXT_PUBLIC_DEMO_MODE`, `NEXTAUTH_URL` exactly). Before running, print only the host to be sure:

```bash
grep -E '^DATABASE_URL_UNPOOLED=' .env.demo | sed -E 's#.*@([^/]+)/.*#\1#'     # must contain eu-central-1
npm run demo:migrate     # applies all migrations to the empty EU database
npm run demo:reset       # re-seeds Alex & Sam, dates relative to today
npm run demo:dev         # http://127.0.0.1:3100 — click through as Alex
```

   (`demo:migrate` = `prisma migrate deploy`, which only applies pending migrations — safe on an empty DB and non-destructive. `demo:reset` refuses to run unless `DEMO_MODE` is set and prints the target host.)

2.2 **🛑 APPROVAL #5 — Vercel `homebase-demo` project settings.** In this order:
   1. Settings → Functions → **Function Region** → `fra1` (dashboard setting, *not* `vercel.json`, so the real app is unaffected). This applies to the next deployment.
   2. Settings → Environment Variables → edit `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in all scopes that exist → the EU Demo strings. Leave the rest.
   3. Deployments → **Redeploy** the latest production deployment (uncheck "use existing build cache": `NEXT_PUBLIC_DEMO_MODE` is baked into the build).
2.3 Verify: open the Demo URL → "Demo — made-up data" marker, continue as Alex, data present; "Reset demo" works and finishes in about a second or two. Check the region: `curl -sI https://<demo-url>/signin | grep -i x-vercel-id` shows `…::fra1::…` for the function part. Run the Demo half of the latency check.
2.4 The old Demo project stays untouched for now (Phase 8).

## Phase 3 — Real app: stage everything, change nothing live

3.1 Prepare (locally, uncommitted) the repo change — **do not push yet**:

```json
// vercel.json
{
  "regions": ["fra1"],
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 8 * * *" },
    { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
  ]
}
```

   plus doc touch-ups: `README.md` line 83 (Demo region note → `fra1`, DB in Frankfurt) and the Deploying section (mention `eu-central-1`/`fra1`); `.env.example` comment optional. A short ADR ("Hosting is in Frankfurt: function region and database region must always move together") is worth adding via the domain-modeling skill because the "never mismatch regions" rule is non-obvious. Remember ADR 0005's rule still holds: every schema change goes to the real DB **and** the Demo.

3.2 Pre-create the new real DB schema state so the cutover only needs data: nothing to do — the final restore brings schema + `_prisma_migrations` with it. (Do **not** run `migrate deploy` on the target before restoring; it would create tables the dump then collides with.)

3.3 Write down the rollback anchors now: the current production deployment URL in Vercel, and the old env values (still in Vercel's env history and in `.env` locally until Phase 5).

## Phase 4 — Real app cutover (the maintenance window)

Target: **~10 minutes**, reads keep working on the old stack until the final switch; only writes made between 4.2 and 4.7 can be missed.

**🛑 APPROVAL #6 — start the cutover** (re-confirm the window with Paul; everything from here changes live state).

4.1 Heads-up to the household: "no changes for ~10 min".
4.2 **Final dump** (read-only, repeat of 1.1; new filename), then verify counts as in 1.5 only against the *target* later. Note the time.
4.3 **Restore into the real target branch** (`homebase-eu` `production`, still empty; the rehearsal branch can be deleted afterwards):

```bash
pg_restore -v --no-owner --no-acl -d "$NEW_UNPOOLED_URL" real-FINAL.dump 2>&1 | tee restore-final.log
psql "$NEW_UNPOOLED_URL" -X -A -t -f compare.sql > counts-new.txt
psql "$OLD_URL"          -X -A -t -f compare.sql > counts-old-final.txt
diff counts-old-final.txt counts-new.txt && echo IDENTICAL     # any difference = a write landed after the dump: see "stragglers" below
DATABASE_URL="$NEW_UNPOOLED_URL" DATABASE_URL_UNPOOLED="$NEW_UNPOOLED_URL" npx prisma migrate status
```

4.4 Vercel real project (**env edits don't affect the running deployment — they only apply to the next one**, so this is safe to do before the switch):
   - Settings → Environment Variables → `DATABASE_URL` (pooled EU string) and `DATABASE_URL_UNPOOLED` (direct EU string), every scope that holds the old value (Production; and Preview/Development if they carry the real DB — they should not point at the live DB, so prefer the `dev` branch or remove them).
   - If Neon integration manages them: disconnect/replace first (decision 3).
4.5 Build the new production deployment **without** serving it yet (needs `vercel login` and `vercel link` to the real project; Hobby supports this):

```bash
cd /Users/paul.mooren/Paul          # working tree has the new vercel.json
vercel pull --yes --environment=production      # writes .vercel/.env.production.local — git-ignored, delete afterwards
vercel deploy --prod --skip-domain              # prints a unique deployment URL, not live
```

   Check on that URL: build log says region `fra1`; `curl -sI <deployment-url>/signin | grep -i x-vercel-id`. Authenticated smoke test of DB connectivity without logging in: `curl -s -H "Authorization: Bearer $CRON_SECRET" "<deployment-url>/api/cron/reminders?dry=1"` should return JSON (reads the new DB through the new pooled string). (Deployment URLs are behind Vercel auth for you only; interactive login there may redirect to the production host because of `NEXTAUTH_URL`, so full click-through happens after promote.)
   *Fallback if `--skip-domain` is unavailable:* merge the `vercel.json` commit to `main`; Vercel then builds and auto-promotes (~1–2 min), which is the same switch without the pre-check.
4.6 **Switch:** `vercel promote <deployment-url>` (or Dashboard → Deployments → ⋯ → Promote to Production). From this second the live site uses Frankfurt functions + Frankfurt DB.
4.7 Immediately: 
   - **Straggler check.** Re-run `compare.sql` on `$OLD_URL` and compare with `counts-old-final.txt`. Identical = no write happened on the old DB after the final dump → nothing lost. If it differs, list the rows (by table, `ORDER BY "updatedAt" DESC LIMIT 20` / `createdAt`) and re-enter or `INSERT` them into the new DB by hand — expected size: zero to a handful.
   - Click-through on the real domain: sign in (existing session cookie should still work), Dashboard, Budgets, create + delete a throwaway task, Vault reveal, Settings → Notifications.
   - `curl -sI https://<real-domain>/signin | grep -i x-vercel-id` shows `fra1`.
4.8 Update the repo: commit and push the `vercel.json` + docs change to `main` (this triggers one more identical deployment — and it also redeploys the **Demo** project, already on the EU DB, now additionally pinned by `vercel.json`; fine). **🛑 APPROVAL #7 — commit/push.** Then delete `.vercel/` leftovers (`.vercel` is git-ignored, but `.vercel/.env.production.local` holds real secrets).
4.9 Freeze the old database so nothing can write to it by accident (a stale `.env` on any laptop would otherwise silently keep using it). **🛑 APPROVAL #8 — change on the old real DB** (reversible):

```sql
ALTER DATABASE neondb SET default_transaction_read_only = on;     -- undo: ... = off
```

   Rollback note: this must be set back to `off` before an emergency rollback (below).

## Phase 5 — Local files

Do this right after 4.6 so no one keeps using the old database. **🛑 APPROVAL #9 — edit local env files** (`.env*` are git-ignored; keep a copy of the old values in `~/homebase-migration/old-env.bak`, chmod 600, until Phase 8).

| File | Change |
| --- | --- |
| `.env` (Prisma reads this) | `DATABASE_URL` → new **pooled** EU string; `DATABASE_URL_UNPOOLED` → new **direct** EU string. Nothing else. |
| `.env.local` (Neon/Next.js) | Same two vars; `NEON_BRANCH=production` stays if the new branch is named `production`. Must equal `.env` (`.env` header comment says to keep them in sync). |
| `.env.demo` | Already changed in Phase 2. |
| `.neon` (git-ignored) | `projectId` → the new project id (`homebase-eu`); `branch` → `production`; `orgId` unchanged. Needed only for the Neon CLI/`neon link`. `neon.ts` needs no change. |
| `.env.example` | No change (placeholders only). |

If decision 2 = dev branch: create `dev` in `homebase-eu`, and put *its* strings into `.env`/`.env.local` instead, leaving only Vercel on `production`. Then the "dev DB == live DB" hazard is gone.

Verify: print hosts only (`sed` as in 2.1), then `npm run dev` and load the app; `npx prisma migrate status` → up to date.

## Phase 6 — Verification before anything is deleted

Run all of these; write the results into `~/homebase-migration/verify.md`. Wait **at least 7 days** (and across at least one real daily cron run) before Phase 8.

- [ ] `compare.sql` old vs new identical at cutover (4.3) and straggler check clean (4.7).
- [ ] Vercel production deployment shows Function Region `fra1`; `x-vercel-id` header confirms. Demo likewise.
- [ ] Vercel env: no remaining reference to `us-east-2` in either project (any scope). Local: `grep -l 'us-east-2' .env .env.local .env.demo` returns nothing; same for `~/.pgpass`, any DB GUI, CI.
- [ ] Neon old projects: Monitoring shows no connections/compute activity since cutover (`compute_last_active_at` stops advancing; with `default_transaction_read_only` any stray writer would also have failed loudly).
- [ ] Real app features: sign in (Google *and* password), CSV import dry run, recurring items, budget groups, Vault reveal, a **push notification actually delivered**, and the cron: after the next 08:00/09:00 UTC window, Vercel → Logs shows `/api/cron/reminders` 200 (or a `skipped` JSON with the Amsterdam hour) with the EU DB; or trigger `?dry=1` manually.
- [ ] Demo: sign-in as Alex and Sam, "Reset demo", nothing mentions real data.
- [ ] After-latency run saved and compared with `latency-before.txt` (see below).
- [ ] Neon usage dashboards of new projects look sane (compute hours, storage ≈ 35 MB, egress).
- [ ] Final **archive dump** of the old real DB taken *after* the 7 days (it should equal the cutover dump since it's read-only), stored encrypted/off-laptop (e.g. in the password manager or an encrypted disk image), plus `VAULT_KEY` backup confirmed to exist outside the database (the `.env` header already insists on this).

## Phase 7 — Rollback

Decide fast, because the longer the new stack takes real writes, the more a rollback costs.

| When | Action |
| --- | --- |
| Before 4.6 (nothing promoted) | Do nothing live: the old deployment is still serving. Delete the unpromoted deployment, optionally revert env edits in Vercel (4.4) — they don't affect the live deployment. |
| After promote, **< ~1 h or no meaningful writes** | 1) `ALTER DATABASE neondb SET default_transaction_read_only = off;` on the *old* DB if 4.9 was applied. 2) Vercel → Deployments → the previous production deployment → **Instant Rollback** (it carries the old env + `iad1` baked in). 3) Revert the env edits so future deploys also use the old DB; revert the `vercel.json`/doc commit (`git revert`). 4) Restore local `.env*` from `old-env.bak`. 5) Writes made on the new DB since the promote are not on the old one: dump them (`pg_dump` new, diff with `compare.sql`) and replay by hand. |
| Later, new DB is the system of record but broken | Don't roll back; restore forward: Neon branch/time-travel inside the new project (6 h window), or the latest `pg_dump` of the new DB. The Phase-1 dump is the fallback of last resort and is only as fresh as the cutover. |
| Demo | Re-point Demo env + `fra1` setting back and redeploy; the old Demo DB is untouched. Or simply `npm run demo:reset` — the Demo has nothing worth preserving. |

Important: never roll back **only** the region or **only** the DB (see the hard rule above).

## Phase 8 — Decommission (irreversible)

**🛑 APPROVAL #10 — delete the old real Neon project** (`ancient-credit-76461142`), only after the whole Phase 6 checklist is ticked and Paul says so in chat. Neon deletes branches (`production`, `old-production`) and the snapshot with the project; the 6 h restore window won't help afterwards. Before deleting, double-check the project id in the Neon console matches the *old* one, not `homebase-eu`.

**🛑 APPROVAL #11 — delete the old Demo project** (`aged-sunset-76824218`) once the new Demo has been used for a day or two. (There is no data to lose, so this can go sooner than #10.)

Afterwards: delete `~/homebase-migration/old-env.bak` and the rehearsal branch; keep the archive dump for ~30 days, then securely remove it; update `README.md`/`PROJECT_STATUS.md` with the new project ids if they're mentioned.

---

## Latency check (run before and after; same place, same network, same time of day)

Goal: measure what actually changed, separately for (A) your laptop → database, (B) the whole round trip through Vercel. Run each block 2–3 times, ignore the first sample of each series: Neon scales to zero after 5 minutes idle, and the first request after idle also pays a compute start (record it separately as "cold").

```bash
mkdir -p ~/homebase-migration && cd ~/homebase-migration
export PATH="/opt/homebrew/opt/postgresql@18/bin:$PATH"
```

**A. Laptop → database round trip (pure network, no Vercel).** Use `DATABASE_URL_UNPOOLED` from the env file for the stack being measured (old before, new after). Hosts only in output, no secrets:

```bash
set -a; . /Users/paul.mooren/Paul/.env; set +a
printf '\\timing on\n%s\n' "$(yes 'select 1;' | head -21)" | psql "$DATABASE_URL_UNPOOLED" -X -q | grep 'Time:' | tail -20 | awk '{s+=$2; if($2>m)m=$2} END{printf "DB RTT from laptop: avg %.1f ms, max %.1f ms (20 samples)\n", s/NR, m}'
```

Expected (rough): Amsterdam/Germany → Ohio ≈ 100–120 ms; → Frankfurt ≈ 10–25 ms. This is the penalty a request *would* pay per query if the function were next to you but the DB were far away — useful as a sanity check of the new region, not of what users feel.

**B. End-to-end through Vercel, including the DB (real app).** The reminders cron route in `?dry=1` mode authenticates with `CRON_SECRET`, reads the database, and sends nothing:

```bash
SECRET=$(grep '^CRON_SECRET=' /Users/paul.mooren/Paul/.env | cut -d= -f2- | tr -d '"')
URL="https://<real-domain>/api/cron/reminders?dry=1"
for i in $(seq 1 12); do
  curl -s -o /dev/null -H "Authorization: Bearer $SECRET" \
    -w "%{time_connect} %{time_starttransfer} %{time_total}\n" "$URL"
done | tee latency-$(date +%Y%m%d-%H%M)-real.txt | awk 'NR>1{c+=$1;s+=$2;t+=$3;n++} END{printf "avg over %d warm calls: connect %.0f ms, first byte %.0f ms, total %.0f ms\n", n, c/n*1000, s/n*1000, t/n*1000}'
curl -sI -H "Authorization: Bearer $SECRET" "$URL" | grep -i x-vercel-id     # shows which region served it (iad1 before, fra1 after)
```

Before: first byte is dominated by the Atlantic crossing to `iad1` (≈ 100–250 ms warm). After: should drop to roughly the cost of a European round trip plus a couple of ~1 ms DB queries (≈ 30–80 ms). If the numbers get *worse* or `x-vercel-id` still says `iad1`, stop and check Phase 6 (region/env mismatch).

**C. What you actually feel (real app and Demo).** In the browser: DevTools → Network → filter `trpc` → reload the Budgets page and open a few pages; note "Waiting for server response (TTFB)" for the `/api/trpc/...` calls (before vs after), plus the Dashboard's total load time. For the Demo (no `CRON_SECRET`): do the same in DevTools on any tRPC call, and time "Reset demo" (README: "a reset takes seconds"; expect ≈ 1–3 s after).

**Record in `latency-before.txt` / `latency-after.txt`:** A avg/max, B warm avg + first cold sample, C TTFB of 3 tRPC calls, date/time, network (home/office/VPN).

---

## Approval checkpoints (summary)

| # | Where | What | Reversible? |
| --- | --- | --- | --- |
| 1 | Phase 0.5 | Create 2 new Neon projects in Frankfurt | Yes (delete them) |
| 2 | Phase 1.1 | Run `pg_dump` against the real DB (read-only) | Yes (nothing changes) |
| 3 | Phase 1.4 | Restore the dump into a rehearsal branch of the *new* project | Yes |
| 4 | Phase 2.1 | Edit `.env.demo`; run `demo:migrate` + `demo:reset` against the new Demo DB | Yes |
| 5 | Phase 2.2 | Vercel Demo: region `fra1`, env vars, redeploy | Yes (settings + env history, old Demo DB untouched) |
| 6 | Phase 4 start | Begin the real cutover (maintenance window) | Until 4.6 yes |
| 7 | Phase 4.8 | Commit/push `vercel.json` + docs to `main` | Yes (`git revert`) |
| 8 | Phase 4.9 | Make the old real DB read-only | Yes (`= off`) |
| 9 | Phase 5 | Edit local `.env`, `.env.local`, `.neon` | Yes (backup kept) |
| 10 | Phase 8 | Delete the old **real** Neon project | **No** |
| 11 | Phase 8 | Delete the old Demo Neon project | **No** (nothing of value in it) |

(The Vercel real-project env edit in 4.4 and the production promote in 4.6 are covered by #6.)

## Key risks

1. **Region mismatch** (fra1 function ↔ Ohio DB, or the reverse) is slower than today. The shared `vercel.json` makes this easy to trigger for the Demo; mitigated by Demo-first with a dashboard region setting, and `vercel.json` last.
2. **Lost writes** between final dump and promote (4.2–4.6). Mitigate with a quiet window, a straggler check on the old DB, and `read_only` on the old DB afterwards.
3. **A stale `.env` anywhere** (another laptop, Vercel Preview/Development scope, a DB GUI) keeps talking to the old DB — and since dev == live, may quietly write there. Mitigate: grep for `us-east-2`, `default_transaction_read_only`, and the 7-day quiet-period check before deleting.
4. **Backup that was never restored** — covered by the rehearsal + hash comparison before any live change.
5. **Dump files contain real finances**: keep outside the repo, `chmod 600`, delete after the archive period.
6. **Client/server version skew**: Postgres 18 on Neon needs `pg_dump` 18+. The default Homebrew `postgresql` formula may be older.
7. **Vault/session breakage** if `VAULT_KEY` or `AUTH_SECRET` were accidentally changed while editing env vars — only the two `DATABASE_URL*` vars should differ from before.
8. **Neon free-tier cold start**: the first request after 5 minutes idle is slow before *and* after; don't read it as a regression.
9. **Irreversible deletion** of the old projects is the only point of no return — gated by the Phase 6 checklist and a 7-day soak.
