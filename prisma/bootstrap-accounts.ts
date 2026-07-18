// Core of the testing-account bootstrap, shared by the standalone script
// (create-demo-users.ts) and the in-app startup hook (src/instrumentation.ts)
// so both create exactly the same accounts. Idempotent; safe on a live DB.
import type { PrismaClient } from "@prisma/client";
import {
  ROLES, PERMISSIONS, ROLE_PERMISSIONS,
  DEVELOPER_EMAIL, DEVELOPER_PASSWORD,
} from "./rbac-catalog";

// One-shot marker (per project decision 2026-07-17): the first boot after this
// ships wipes ALL existing users — the old per-role demo accounts plus any
// test signups — so only the developer account remains. Marker-gated so later
// deploys never touch real users again.
const USERS_RESET_MARKER = "bootstrap.usersResetToDeveloperOnly.v1";

// One-shot developer credential reset (owner request, 2026-07-18): the
// previous production password was lost. A first attempt (marker
// ...devCredentialRotation.2026-07-18) wrote a pre-computed hash that turned
// out not to verify against any known password, locking the account out
// entirely. The v2 reset below re-hashes the CURRENT default (or
// ADMIN_PASSWORD when set) through better-auth's own hasher at runtime, so
// the resulting credential is guaranteed to verify. Marker-gated so later
// deploys never re-apply it — an in-app password change stays safe.
const DEV_CREDENTIAL_ROTATION_MARKER = "bootstrap.devCredentialRotation.2026-07-18.v2";

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
  const developer = await upsertAccount(DEVELOPER_EMAIL, "Developer", developerPassword);
  for (const [code] of ROLES) await ensureRole(developer.id, roleIds.get(code)!);
  log(`✓ developer user ${DEVELOPER_EMAIL} holds all ${ROLES.length} roles`);

  // 4. One-time credential reset (see marker comment above). Hashed at
  // runtime through the same hasher the app verifies with, so the credential
  // is guaranteed to work: developer / DEVELOPER_PASSWORD (or ADMIN_PASSWORD
  // when that env var is set). Owner should change it in-app right after.
  const rotationDone = await db.systemSetting.findUnique({
    where: { key: DEV_CREDENTIAL_ROTATION_MARKER },
  });
  if (!rotationDone) {
    await db.account.updateMany({
      where: { userId: developer.id, providerId: "credential" },
      data: { password: await hash(developerPassword) },
    });
    await db.systemSetting.create({
      data: { key: DEV_CREDENTIAL_ROTATION_MARKER, value: new Date().toISOString() },
    });
    log(`✓ one-time developer credential reset applied (marker ${DEV_CREDENTIAL_ROTATION_MARKER})`);
  }
}
