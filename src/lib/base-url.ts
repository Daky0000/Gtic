import "server-only";

/**
 * The app's public origin, resolved from (in order):
 *  1. NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL (explicit configuration)
 *  2. RAILWAY_PUBLIC_DOMAIN (injected automatically by Railway)
 *  3. localhost fallback for local dev
 * Keeping this in one place means auth origins, payment callbacks and
 * webhook URLs can never disagree with each other.
 */
const LOOPBACK_HOST = /^(localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\])$/i;

/** Normalizes a configured value ("example.com", "https://example.com/") to
 * an origin, or null when it isn't a usable URL. */
function normalizeOrigin(value: string): string | null {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

export function appBaseUrl(): string {
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : null;
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL]) {
    if (!value?.trim()) continue;
    const origin = normalizeOrigin(value.trim());
    if (!origin) continue;
    // On a deployed platform a loopback value is always a misconfiguration —
    // payment callbacks and auth built on it would strand real users on
    // localhost. Fall through to the platform-injected public domain instead.
    if (railway && LOOPBACK_HOST.test(new URL(origin).hostname)) continue;
    return origin;
  }
  return railway ?? "http://localhost:3000";
}

/** Every origin browsers may legitimately send for this deployment. */
export function trustedOrigins(): string[] {
  const origins = new Set<string>();
  for (const v of [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined,
    "http://localhost:3000",
  ]) {
    if (v) origins.add(v.replace(/\/$/, ""));
  }
  // Optional, comma-separated escape hatch — e.g. keep a platform-generated
  // subdomain (gtic-production.up.railway.app) trusted alongside a custom
  // domain during a migration, without hardcoding either into source.
  for (const v of (process.env.EXTRA_TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = v.trim().replace(/\/$/, "");
    if (trimmed) origins.add(trimmed);
  }
  return [...origins];
}
