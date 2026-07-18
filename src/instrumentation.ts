/**
 * Next.js instrumentation hook — runs once inside the server process at
 * startup, regardless of HOW the server was started (`npm run start`,
 * `next start`, or a platform's custom start command). This is the last line
 * of defence that guarantees migrations and the testing accounts exist in
 * production even when platform pre-deploy/start configuration is ignored —
 * exactly what happened on Railway in July 2026.
 *
 * Everything here is best-effort and idempotent: failures are logged, never
 * fatal, so a transient DB hiccup can't crash-loop the app.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  // 1. Apply pending migrations (best effort — usually a no-op).
  try {
    // webpackIgnore keeps the bundler from trying to resolve the node: scheme
    // (it can't; the failed module poisons every route in dev). The import
    // only ever runs in the nodejs runtime thanks to the guards above.
    const { spawnSync } = await import(/* webpackIgnore: true */ "node:child_process");
    const res = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { stdio: "pipe", encoding: "utf8", timeout: 120_000 }
    );
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`.trim().split("\n").slice(-2).join(" | ");
    console.log(`[startup] prisma migrate deploy (exit ${res.status}): ${out}`);
  } catch (e) {
    console.error("[startup] migrate deploy failed (continuing):", e);
  }

  // 2. Ensure the role catalog and testing accounts exist.
  try {
    const { db } = await import("@/lib/db");
    const { auth } = await import("@/lib/auth");
    const { bootstrapAccounts } = await import("../prisma/bootstrap-accounts");
    const ctx = await auth.$context;
    await bootstrapAccounts(db, (pw) => ctx.password.hash(pw), (m) => console.log("[startup]", m));
    console.log("[startup] account bootstrap complete");
  } catch (e) {
    console.error("[startup] account bootstrap failed (continuing):", e);
  }
}
