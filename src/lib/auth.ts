import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { appBaseUrl, trustedOrigins } from "@/lib/base-url";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  // Resolved from explicit env vars or the Railway-injected public domain,
  // so an unset BETTER_AUTH_URL can't brick every login with "Invalid origin".
  baseURL: appBaseUrl(),
  trustedOrigins: trustedOrigins(),
  emailAndPassword: {
    enabled: true,
    // Verification stays off until an email sender is configured in prod —
    // requiring it with no working mailer would lock every applicant out.
    requireEmailVerification: false,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      const { sendEmail } = await import("@/lib/mailer");
      await sendEmail({
        to: user.email,
        subject: "Reset your SYDA-GTIC password",
        text:
          `Hello ${user.name || ""},\n\n` +
          `Someone (hopefully you) asked to reset the password for this account.\n` +
          `Open the link below to choose a new password. It expires in 1 hour.\n\n` +
          `${url}\n\n` +
          `If you did not request this, you can ignore this email.`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  // nextCookies must be the last plugin so server actions set cookies correctly.
  plugins: [nextCookies()],
});

export type ServerSession = typeof auth.$Infer.Session;
