// Deploy-time account bootstrap — idempotent and safe against a live
// production database. It syncs the role/permission catalog, then creates
// (or heals) the standard testing accounts: one user per role plus the
// all-roles super user. Unlike the full demo seed, it touches NOTHING else —
// no programmes, cycles, students or records of any kind.
//
// Passwords: every run RESETS the testing accounts' passwords so the
// documented credentials always work.
//   DEMO_PASSWORD   password for the per-role testing users (default below)
//   ADMIN_PASSWORD  password for the super user (falls back to DEMO_PASSWORD)
//
// Runs automatically as part of the Railway pre-deploy command; run manually
// with `npm run users:demo`.
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS,
  SUPER_USER_EMAIL, DEFAULT_DEMO_PASSWORD, demoEmailForRole,
} from "./rbac-catalog";

const db = new PrismaClient();

// Same (plugin-free) better-auth instance the seed uses, so password hashes
// are written in exactly the format the running app verifies against.
const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
});

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
const SUPER_PASSWORD = process.env.ADMIN_PASSWORD || DEMO_PASSWORD;

/** Create the user + credential if missing, otherwise reset the password. */
async function upsertAccount(email: string, name: string, password: string) {
  const hash = await (await auth.$context).password.hash(password);
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    user = await db.user.create({ data: { name, email, emailVerified: true } });
    await db.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id, password: hash },
    });
  } else {
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    const cred = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (cred) {
      await db.account.update({ where: { id: cred.id }, data: { password: hash } });
    } else {
      await db.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: hash },
      });
    }
  }
  return user;
}

async function ensureRole(userId: string, roleId: string) {
  const existing = await db.roleAssignment.findFirst({ where: { userId, roleId } });
  if (!existing) await db.roleAssignment.create({ data: { userId, roleId } });
}

async function main() {
  // 1. Role + permission catalog (idempotent upserts).
  const roleIds = new Map<string, string>();
  for (const [code, name] of ROLES) {
    const role = await db.role.upsert({ where: { code }, update: { name }, create: { code, name } });
    roleIds.set(code, role.id);
  }
  for (const [code, name, module] of PERMISSIONS) {
    await db.permission.upsert({ where: { code }, update: { name, module }, create: { code, name, module } });
  }
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permCode of permCodes) {
      const perm = await db.permission.findUniqueOrThrow({ where: { code: permCode } });
      const roleId = roleIds.get(roleCode)!;
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }
  }
  console.log(`✓ ${ROLES.length} roles, ${PERMISSIONS.length} permissions`);

  // 2. One testing user per role.
  for (const [code, name] of ROLES) {
    const user = await upsertAccount(demoEmailForRole(code), `Demo ${name}`, DEMO_PASSWORD);
    await ensureRole(user.id, roleIds.get(code)!);
  }
  console.log(`✓ ${ROLES.length} testing users (one per role, password ${process.env.DEMO_PASSWORD ? "from DEMO_PASSWORD" : `"${DEFAULT_DEMO_PASSWORD}"`})`);

  // 3. Super user holding every role.
  const superUser = await upsertAccount(SUPER_USER_EMAIL, "Super Admin", SUPER_PASSWORD);
  for (const [code] of ROLES) await ensureRole(superUser.id, roleIds.get(code)!);
  console.log(`✓ super user ${SUPER_USER_EMAIL} holds all ${ROLES.length} roles (password ${process.env.ADMIN_PASSWORD ? "from ADMIN_PASSWORD" : "same as testing users"})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
