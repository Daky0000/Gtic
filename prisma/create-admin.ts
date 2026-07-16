// Targeted, idempotent super-admin bootstrap — creates (or resets the
// password of) ONE developer/super-administrator account and nothing else.
// Safe to run against a live production database: it never touches demo data,
// programmes, students or any other records — only the single admin user, the
// `developer` role, and their role assignment.
//
// Run it against production from a machine that can reach the DB, e.g.:
//   DATABASE_URL="<prod public url>" ADMIN_PASSWORD="<choose one>" npm run admin:create
// ADMIN_PASSWORD is required (no default — nothing secret is committed).
// Optional overrides: ADMIN_EMAIL, ADMIN_NAME
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const db = new PrismaClient();

// Same (plugin-free) better-auth instance the seed uses, so the password hash
// is written in exactly the format the running app verifies against.
const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const EMAIL = process.env.ADMIN_EMAIL ?? "super@demo.campuscore.test";
const PASSWORD = process.env.ADMIN_PASSWORD;
const NAME = process.env.ADMIN_NAME ?? "Super Admin";

if (!PASSWORD || PASSWORD.length < 8) {
  console.error(
    "ADMIN_PASSWORD env var is required (min 8 chars).\n" +
      'Example:  DATABASE_URL="<prod url>" ADMIN_PASSWORD="<choose one>" npm run admin:create',
  );
  process.exit(1);
}

async function main() {
  // 1. Ensure the developer (super administrator) role exists.
  const role = await db.role.upsert({
    where: { code: "developer" },
    update: {},
    create: { code: "developer", name: "Developer / Super Administrator" },
  });

  // 2. Hash the password with better-auth's own hasher.
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(PASSWORD);

  // 3. Create the user + credential account, or reset the password if the
  //    account already exists.
  let user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await db.user.create({
      data: { name: NAME, email: EMAIL, emailVerified: true },
    });
    await db.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id, password: hash },
    });
    console.log(`✓ created admin user ${EMAIL}`);
  } else {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    const cred = await db.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (cred) {
      await db.account.update({ where: { id: cred.id }, data: { password: hash } });
    } else {
      await db.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: hash },
      });
    }
    console.log(`✓ reset password for existing user ${EMAIL}`);
  }

  // 4. Ensure the developer role is assigned (open-ended).
  const existing = await db.roleAssignment.findFirst({
    where: { userId: user.id, roleId: role.id, effectiveTo: null },
  });
  if (!existing) {
    await db.roleAssignment.create({ data: { userId: user.id, roleId: role.id } });
    console.log("✓ assigned developer / super-administrator role");
  } else {
    console.log("✓ developer role already assigned");
  }

  console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
