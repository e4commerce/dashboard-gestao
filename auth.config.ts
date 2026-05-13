import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Node.js-only imports (crypto, bcrypt, etc).
// Used by middleware.ts. The full auth.ts extends this with the Credentials provider.
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365 },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "admin";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role =
          (token.role as string) ?? "admin";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
