// Standalone runner for the account bootstrap — used by `npm run start` (in
// production before the server boots), by `npm run users:demo` manually, and
// by CI. The logic lives in bootstrap-accounts.ts, shared with the in-app
// startup hook (src/instrumentation.ts) so every path creates the same
// accounts. Idempotent and safe against a live production database.
//
// Accounts: creates ONLY the all-roles developer user (per project decision
// 2026-07-17), after a one-time marker-gated wipe of all pre-existing users.
// The catalog default password is used only when the account is first created
// (or when a credential row has no password); an existing working credential
// is never overwritten, so in-app password changes survive deploys. Env-var
// password overrides were removed 2026-07-18 — see bootstrap-accounts.ts.
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bootstrapAccounts } from "./bootstrap-accounts";
import { bootstrapInstitutionCatalog } from "./bootstrap-catalog";

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
  await bootstrapInstitutionCatalog(db);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
