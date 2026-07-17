import "server-only";
import { db } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { anthropicProvider, setAnthropicKey } from "./providers/anthropic";
import { mockProvider } from "./providers/mock";
import type { AIProvider, Effort } from "./types";

// ─── Per-feature configuration (shared by the chat service and AI tasks) ───

export type FeatureConfig = {
  feature: string;
  enabled: boolean;
  provider: "auto" | "anthropic" | "mock";
  model: string;
  effort: Effort;
  monthlyTokenBudget: number | null;
  systemPromptExtra: string | null;
};

const DEFAULT_CONFIG: Omit<FeatureConfig, "feature"> = {
  enabled: true,
  provider: "auto",
  model: "claude-opus-4-8",
  effort: "medium",
  monthlyTokenBudget: null,
  systemPromptExtra: null,
};

const configCache = new Map<string, { value: FeatureConfig; at: number }>();
const CONFIG_TTL_MS = 60_000;

export async function getFeatureConfig(feature: string): Promise<FeatureConfig> {
  const hit = configCache.get(feature);
  if (hit && Date.now() - hit.at < CONFIG_TTL_MS) return hit.value;

  const row = await db.aIFeatureConfig.findUnique({ where: { feature } });
  const value: FeatureConfig = row
    ? {
        feature,
        enabled: row.enabled,
        provider: row.provider as FeatureConfig["provider"],
        model: row.model,
        effort: row.effort as Effort,
        monthlyTokenBudget: row.monthlyTokenBudget,
        systemPromptExtra: row.systemPromptExtra,
      }
    : { feature, ...DEFAULT_CONFIG };
  configCache.set(feature, { value, at: Date.now() });
  return value;
}

export async function resolveProvider(cfg: FeatureConfig): Promise<AIProvider> {
  const forced = cfg.provider;
  // System settings (developer console) override env vars at runtime.
  const pref = ((await getSetting(SETTING_KEYS.AI_PROVIDER)) ?? "auto").toLowerCase();
  const apiKey = await getSetting(SETTING_KEYS.ANTHROPIC_API_KEY);

  const choice =
    forced !== "auto" ? forced : pref !== "auto" ? pref : apiKey ? "anthropic" : "mock";

  if (choice === "anthropic" && !apiKey) {
    console.warn(`[ai] feature "${cfg.feature}" forced to anthropic but no API key — using mock`);
    return mockProvider;
  }
  if (choice === "anthropic") {
    setAnthropicKey(apiKey ?? undefined);
    return anthropicProvider;
  }
  return mockProvider;
}

/** Monthly token budget check (tokens used this calendar month per feature). */
export async function budgetExceeded(cfg: FeatureConfig): Promise<boolean> {
  if (cfg.monthlyTokenBudget == null) return false;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const agg = await db.aIAuditLog.aggregate({
    where: { feature: cfg.feature, createdAt: { gte: monthStart } },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const used = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0);
  return used >= cfg.monthlyTokenBudget;
}

/** Per-user daily call cap: the monthly budget is shared by everyone, so
 * without this any single signed-in user could drain it (or just run up the
 * Anthropic bill) by hammering the endpoint. */
export const USER_DAILY_CALL_LIMIT = 50;

export async function userDailyLimitExceeded(
  userId: string,
  feature: string,
  limit: number = USER_DAILY_CALL_LIMIT
): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const calls = await db.aIAuditLog.count({
    where: { userId, feature, outcome: "OK", createdAt: { gte: dayStart } },
  });
  return calls >= limit;
}

export async function logAICall(entry: {
  userId?: string | null;
  feature: string;
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  latencyMs: number;
  outcome: "OK" | "ERROR" | "REFUSAL" | "BUDGET_BLOCKED" | "DISABLED";
  error?: string;
}): Promise<void> {
  try {
    await db.aIAuditLog.create({
      data: {
        userId: entry.userId ?? null,
        feature: entry.feature,
        provider: entry.provider,
        model: entry.model,
        inputTokens: entry.inputTokens ?? 0,
        outputTokens: entry.outputTokens ?? 0,
        cacheReadTokens: entry.cacheReadTokens ?? 0,
        latencyMs: entry.latencyMs,
        outcome: entry.outcome,
        error: entry.error,
      },
    });
  } catch (e) {
    console.error("[ai] failed to write AI audit log", e);
  }
}
