// Standalone runner for the account bootstrap — used by `npm run start` (in
// production before the server boots), by `npm run users:demo` manually, and
// by CI. The logic lives in bootstrap-accounts.ts, shared with the in-app
// startup hook (src/instrumentation.ts) so every path creates the same
// accounts. Idempotent and safe against a live production database.
//
// Passwords: every run RESETS the testing accounts' passwords so the
// documented credentials always work. All accounts share one simple default
// (DEMO_SHARED_PASSWORD in rbac-catalog.ts); env overrides:
//   DEMO_PASSWORD   one shared password for ALL per-role testing users
//   ADMIN_PASSWORD  password for the super user
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bootstrapAccounts } from "./bootstrap-accounts";

const db = new PrismaClient();

// Same (plugin-free) better-auth instance the seed uses, so password hashes
// are written in exactly the format the running app verifies against.
const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

async function main() {
  const ctx = await auth.$context;
  await bootstrapAccounts(db, (pw) => ctx.password.hash(pw));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
