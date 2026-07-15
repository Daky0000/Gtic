import "server-only";

/**
 * The app's public origin, resolved from (in order):
 *  1. NEXT_PUBLIC_APP_URL / BETTER_AUTH_URL (explicit configuration)
 *  2. RAILWAY_PUBLIC_DOMAIN (injected automatically by Railway)
 *  3. localhost fallback for local dev
 * Keeping this in one place means auth origins, payment callbacks and
 * webhook URLs can never disagree with each other.
 */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return "http://localhost:3000";
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
  return [...origins];
}
