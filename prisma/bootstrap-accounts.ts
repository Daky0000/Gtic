// Core of the testing-account bootstrap, shared by the standalone script
// (create-demo-users.ts) and the in-app startup hook (src/instrumentation.ts)
// so both create exactly the same accounts. Idempotent; safe on a live DB.
import type { PrismaClient } from "@prisma/client";
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS,
  SUPER_USER_EMAIL, SUPER_USER_PASSWORD, demoEmailForRole, demoPasswordForRole,
} from "./rbac-catalog";

export async function bootstrapAccounts(
  db: PrismaClient,
  hash: (password: string) => Promise<string>,
  log: (msg: string) => void = console.log
) {
  const sharedOverride = process.env.DEMO_PASSWORD || null;
  const superPassword = process.env.ADMIN_PASSWORD || SUPER_USER_PASSWORD;

  async function upsertAccount(email: string, name: string, password: string) {
    const passwordHash = await hash(password);
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({ data: { name, email, emailVerified: true } });
      await db.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash },
      });
    } else {
      await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      const cred = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
      if (cred) {
        await db.account.update({ where: { id: cred.id }, data: { password: passwordHash } });
      } else {
        await db.account.create({
          data: { accountId: user.id, providerId: "credential", userId: user.id, password: passwordHash },
        });
      }
    }
    return user;
  }

  async function ensureRole(userId: string, roleId: string) {
    const existing = await db.roleAssignment.findFirst({ where: { userId, roleId } });
    if (!existing) await db.roleAssignment.create({ data: { userId, roleId } });
  }

  // 1. Role + permission catalog.
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
  log(`✓ ${ROLES.length} roles, ${PERMISSIONS.length} permissions`);

  // 2. One testing user per role.
  for (const [code, name] of ROLES) {
    const user = await upsertAccount(
      demoEmailForRole(code),
      `Demo ${name}`,
      sharedOverride ?? demoPasswordForRole(code)
    );
    await ensureRole(user.id, roleIds.get(code)!);
  }
  log(`✓ ${ROLES.length} testing users (${sharedOverride ? "shared password from DEMO_PASSWORD" : "per-role default passwords"})`);

  // 3. Super user holding every role.
  const superUser = await upsertAccount(SUPER_USER_EMAIL, "Super Admin", superPassword);
  for (const [code] of ROLES) await ensureRole(superUser.id, roleIds.get(code)!);
  log(`✓ super user ${SUPER_USER_EMAIL} holds all ${ROLES.length} roles`);
}
