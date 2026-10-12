import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { DEMO_PERSONAS, isDemoServer } from "@/lib/demo";

/**
 * The Demo's one-click sign-in as Alex or Sam. It refuses unless DEMO_MODE is set (checked per request), and
 * only ever signs in the two made-up people — never a real account.
 */
const demoSignIn = () => ({
  id: "demo-sign-in" as const,
  endpoints: {
    signInDemo: createAuthEndpoint(
      "/sign-in/demo",
      { method: "POST", body: z.object({ persona: z.string() }) },
      async (ctx) => {
        if (!isDemoServer()) return ctx.json({ ok: false }, { status: 404 });
        const persona = DEMO_PERSONAS.find((p) => p.key === ctx.body.persona);
        if (!persona) return ctx.json({ ok: false }, { status: 400 });
        const found = await ctx.context.internalAdapter.findUserByEmail(persona.email);
        if (!found) return ctx.json({ ok: false }, { status: 400 });
        const session = await ctx.context.internalAdapter.createSession(found.user.id);
        await setSessionCookie(ctx, { session, user: found.user });
        return ctx.json({ ok: true });
      },
    ),
  },
});

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Where a sign-in may come from. The Demo runs on its own host with its own secret and database, so it only
  // ever needs its own address here.
  trustedOrigins: [appUrl],

  // The Better Auth tables are named Auth* so they sit beside the old Auth.js ones until those are dropped.
  user: {
    modelName: "user",
    fields: { emailVerified: "emailIsVerified" },
  },
  session: {
    modelName: "authSession",
    // Re-checking the database on every request is wasteful; a signed 5-minute cookie answers repeat calls.
    // Signing out elsewhere (or removing a session) takes effect within that window.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  account: {
    modelName: "authAccount",
    accountLinking: {
      enabled: true,
      // Google verifies email ownership itself, so a Google sign-in may link to an existing user with the
      // same email (e.g. one created with a password).
      trustedProviders: ["google"],
    },
  },
  verification: { modelName: "authVerification" },

  emailAndPassword: {
    enabled: true,
    // Existing passwords are bcrypt hashes (copied over by the better_auth_tables migration), so keep bcrypt.
    password: {
      hash: (password) => hashPassword(password),
      verify: ({ password, hash }) => verifyPassword(password, hash),
    },
    minPasswordLength: 8,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  // Serverless instances don't share memory, so rate limits live in the database.
  rateLimit: { enabled: true, storage: "database", modelName: "authRateLimit" },

  // nextCookies must stay last: it lets server actions set the session cookie.
  plugins: [demoSignIn(), nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
