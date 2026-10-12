# Sign-in is Better Auth, self-hosted in the app, replacing Auth.js

Auth.js v5 was still a beta, kept sessions in a signed cookie that could not be revoked, and had no path to the sign-in features this app will want (email verification, password reset, passkeys, two-factor). Better Auth runs inside the same Next.js app and the same Prisma database, so we keep owning the sign-in data and the login identity (`User`, with its ids, which every Household table points at). We rejected Neon's managed Better Auth because it limits which plugins we can use, and staying on Auth.js because of the beta and the missing features.

The new tables are named `Auth*` and sit beside the old Auth.js ones. Existing passwords keep working: each bcrypt hash was copied into a `credential` account and Better Auth is configured to verify bcrypt. Google links were copied across too. Sessions are rows in the database (with a 5-minute signed cookie cache), so a session can be revoked. `proxy.ts` only checks that a session cookie exists; the real check is `getSession()` in the tRPC context, server actions and pages.

## Consequences

- Everyone signed in at the cutover is signed out once; the app also moved to `app.getnest.eu`, so push subscriptions and the installed Home Screen app had to be set up again.
- The passkey relying-party ID will be `getnest.eu`. Prod and the Demo must never share cookies: no cross-subdomain cookies, and each has its own `BETTER_AUTH_SECRET`.
- Google's account link auto-merges by email only for Google (`trustedProviders`). Password users from before the switch are unverified until email verification ships (phase 2); only new sign-ups will have to verify.
- The Demo's one-click sign-in is a small plugin endpoint that refuses unless `DEMO_MODE` is set.
- A cleanup migration (after a few stable days) drops `next-auth`, `@auth/*`, the old `Account`, `Session` and `VerificationToken` models and `User.password` / `User.emailVerified`. Until then the previous release still works against the same database.
