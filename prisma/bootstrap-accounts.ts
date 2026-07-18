// Core of the testing-account bootstrap, shared by the standalone script
// (create-demo-users.ts) and the in-app startup hook (src/instrumentation.ts)
// so both create exactly the same accounts. Idempotent; safe on a live DB.
import type { PrismaClient } from "@prisma/client";
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS,
  DEVELOPER_EMAIL, DEVELOPER_PASSWORD,
} from "./rbac-catalog";

// One-shot HARD RESET marker (owner request, 2026-07-18): a previous rotation
// left the developer credential with a pre-computed hash that verified against
// no password, locking every login out. To guarantee a clean, working state
// the first boot after this ships WIPES ALL users (old demo accounts + any
// test signups) and recreates the developer account from scratch — the
// create path hashes the password at runtime through better-auth's own hasher,
// so the credential is guaranteed to verify. Marker-gated: bumping the version
// forces exactly one fresh wipe+recreate; later deploys never touch users
// again, so real signups and in-app password changes are safe afterwards.
const USERS_RESET_MARKER = "bootstrap.hardResetToDeveloperOnly.2026-07-18.v3";

export async function bootstrapAccounts(
  db: PrismaClient,
  hash: (password: string) => Promise<string>,
  log: (msg: string) => void = console.log
) {
  // The catalog default is only ever used to CREATE the account. An existing
  // credential is left untouched unless ADMIN_PASSWORD / DEMO_PASSWORD is set,
  // so a password changed in-app (or a rotated env var) survives every deploy
  // and the publicly-known default can never be silently re-applied.
  const explicitPassword = process.env.ADMIN_PASSWORD || process.env.DEMO_PASSWORD || null;
  const developerPassword = explicitPassword ?? DEVELOPER_PASSWORD;

  async function upsertAccount(email: string, name: string, password: string) {
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({ data: { name, email, emailVerified: true } });
      await db.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: await hash(password) },
      });
      return user;
    }
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    const cred = await db.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (!cred) {
      await db.account.create({
        data: { accountId: user.id, providerId: "credential", userId: user.id, password: await hash(password) },
      });
    } else if (explicitPassword) {
      await db.account.update({ where: { id: cred.id }, data: { password: await hash(explicitPassword) } });
    } else if (!cred.password) {
      // A credential row with no password can never log in — repair it with
      // the default rather than leaving the account permanently locked out.
      await db.account.update({ where: { id: cred.id }, data: { password: await hash(password) } });
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

  // 2. One-time wipe of every pre-existing user (and their owned data, via
  // FK cascade) so only the developer account below remains. TRUNCATE CASCADE
  // clears user-owned tables transitively but leaves institutional catalogs
  // (roles, programmes, courses, settings) untouched.
  const alreadyReset = await db.systemSetting.findUnique({ where: { key: USERS_RESET_MARKER } });
  if (!alreadyReset) {
    const before = await db.user.count();
    await db.$executeRawUnsafe(`TRUNCATE TABLE "user" CASCADE`);
    await db.systemSetting.create({
      data: { key: USERS_RESET_MARKER, value: new Date().toISOString() },
    });
    log(`✓ one-time reset: removed ${before} existing users (marker ${USERS_RESET_MARKER})`);
  }

  // 3. The single developer user, holding every role so all portals open.
  // After a hard reset (step 2) this is a fresh CREATE, so the password is
  // hashed at runtime and the login is guaranteed to work:
  //   developer@demo.campuscore.test / DEVELOPER_PASSWORD  (or ADMIN_PASSWORD).
  // Owner should change it in-app immediately (the repo is public).
  const developer = await upsertAccount(DEVELOPER_EMAIL, "Developer", developerPassword);
  for (const [code] of ROLES) await ensureRole(developer.id, roleIds.get(code)!);
  log(`✓ developer user ${DEVELOPER_EMAIL} holds all ${ROLES.length} roles`);
}
