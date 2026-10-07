import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { DEMO_PERSONAS, isDemoServer } from "@/lib/demo";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    // The Demo's one-click sign-in as Alex or Sam. Only exists where DEMO_MODE is set, and only ever
    // signs in the two made-up people — never a real account.
    ...(isDemoServer()
      ? [
          Credentials({
            id: "demo",
            credentials: { persona: {} },
            async authorize(credentials) {
              const persona = DEMO_PERSONAS.find((p) => p.key === String(credentials?.persona ?? ""));
              if (!persona) return null;
              const user = await prisma.user.findUnique({ where: { email: persona.email } });
              return user ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
            },
          }),
        ]
      : []),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Safe here specifically because Google verifies email ownership itself —
      // this links a Google sign-in to an existing user row with the same email
      // (e.g. from the old magic-link days) instead of refusing with
      // OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await verifyPassword(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
