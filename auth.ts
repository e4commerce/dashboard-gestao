import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { ALLOWED_EMAILS, getNameForEmail } from "@/server/auth/allowed-emails";
import { verifyOtp } from "@/server/auth/otp";

const credentialsSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp_code: z.string().min(6).max(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        otp_code: { label: "Código", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, otp_code } = parsed.data;
        if (!ALLOWED_EMAILS.has(email)) return null;

        const ok = await verifyOtp(email, otp_code);
        if (!ok) return null;

        return {
          id: email,
          email,
          name: getNameForEmail(email),
          role: "admin",
        };
      },
    }),
  ],
});

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }
}
