import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Accept browser requests from the public app URL as well as
  // BETTER_AUTH_URL, so a mismatch between the two env vars doesn't brick
  // every login with "Invalid origin".
  trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
    (v): v is string => !!v
  ),
  emailAndPassword: {
    enabled: true,
    // Email verification and password reset flows are wired to the
    // notification engine in a later step of Phase 0/1.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  // nextCookies must be the last plugin so server actions set cookies correctly.
  plugins: [nextCookies()],
});

export type ServerSession = typeof auth.$Infer.Session;
