import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getClient } from "./providers/anthropic";
import { getFeatureConfig, logAICall, resolveProvider } from "./config";

// ─── Safe, read-only, parameterized query tools (MGT-02) ───
// The model can only call these named functions — never raw SQL — and every
// query is scoped to aggregate counts, never individual student records.

async function countApplications(args: { status?: string }) {
  const cycle = await db.admissionCycle.findFirst({ where: { status: "OPEN" }, orderBy: { opensAt: "desc" } });
  if (!cycle) return { count: 0, note: "No open admission cycle." };
  const count = await db.application.count({
    where: { cycleId: cycle.id, ...(args.status ? { status: args.status as never } : {}) },
  });
  return { cycle: cycle.name, statusFilter: args.status ?? "any", count };
}

async function countStudents(args: { status?: string }) {
  const count = await db.student.count({ where: args.status ? { status: args.status as never } : {} });
  return { statusFilter: args.status ?? "any", count };
}

async function feeCollectionSummary() {
  const invoices = await db.invoice.findMany({ where: { kind: "TUITION" } });
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const collected = invoices.reduce((s, i) => s + i.paid, 0);
  return {
    billedGHS: billed / 100,
    collectedGHS: collected / 100,
    percentCollected: billed > 0 ? Math.round((collected / billed) * 100) : 0,
  };
}

async function passRateSummary() {
  const entries = await db.gradeEntry.findMany({ where: { gradeSheet: { status: "PUBLISHED" } } });
  const total = entries.length;
  const passed = entries.filter((e) => (e.total ?? 0) >= 40).length;
  return { totalGraded: total, passed, passRatePercent: total > 0 ? Math.round((passed / total) * 100) : 0 };
}

const TOOL_DEFS = [
  {
    name: "count_applications",
    description: "Count admission applications in the current open cycle, optionally filtered by status (e.g. SUBMITTED, UNDER_REVIEW, OFFER_ISSUED, ACCEPTED, REJECTED).",
    input_schema: { type: "object" as const, properties: { status: { type: "string" as const } } },
  },
  {
    name: "count_students",
    description: "Count enrolled students, optionally filtered by status (ACTIVE, DEFERRED, WITHDRAWN, DISMISSED, GRADUATED).",
    input_schema: { type: "object" as const, properties: { status: { type: "string" as const } } },
  },
  {
    name: "fee_collection_summary",
    description: "Get total tuition billed vs. collected across all invoices, in GHS.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "pass_rate_summary",
    description: "Get the overall pass rate across every published course result.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "count_applications": return countApplications(input as { status?: string });
    case "count_students": return countStudents(input as { status?: string });
    case "fee_collection_summary": return feeCollectionSummary();
    case "pass_rate_summary": return passRateSummary();
    default: return { error: `Unknown tool: ${name}` };
  }
}

export type AnalyticsToolCall = { name: string; result: unknown };

export async function askAnalyticsQuestion(opts: {
  userId: string;
  question: string;
}): Promise<{ answer: string; toolCalls: AnalyticsToolCall[] }> {
  const FEATURE = "analytics";
  const startedAt = Date.now();
  const cfg = await getFeatureConfig(FEATURE);
  const provider = await resolveProvider(cfg);

  if (provider.name === "mock") {
    const q = opts.question.toLowerCase();
    const toolCalls: AnalyticsToolCall[] = [];
    let answer: string;
    if (q.includes("applicant") || q.includes("application")) {
      const r = await countApplications({});
      toolCalls.push({ name: "count_applications", result: r });
      answer = `(mock AI) ${r.count} application(s) in "${r.cycle ?? "the open cycle"}".`;
    } else if (q.includes("student")) {
      const r = await countStudents({});
      toolCalls.push({ name: "count_students", result: r });
      answer = `(mock AI) ${r.count} student(s) on record.`;
    } else if (q.includes("fee") || q.includes("collect")) {
      const r = await feeCollectionSummary();
      toolCalls.push({ name: "fee_collection_summary", result: r });
      answer = `(mock AI) GHS ${r.collectedGHS.toFixed(2)} collected of GHS ${r.billedGHS.toFixed(2)} billed (${r.percentCollected}%).`;
    } else if (q.includes("pass") || q.includes("result")) {
      const r = await passRateSummary();
      toolCalls.push({ name: "pass_rate_summary", result: r });
      answer = `(mock AI) Pass rate: ${r.passRatePercent}% (${r.passed}/${r.totalGraded} published grades).`;
    } else {
      answer = "(mock AI) I can answer questions about applications, students, fee collection and pass rates.";
    }
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "mock", model: cfg.model, inputTokens: 80, outputTokens: 40, latencyMs: Date.now() - startedAt, outcome: "OK" });
    return { answer, toolCalls };
  }

  try {
    const toolCalls: AnalyticsToolCall[] = [];
    let messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.question }];
    let finalText = "";
    let totalInput = 0;
    let totalOutput = 0;

    for (let i = 0; i < 3; i++) {
      const response = await getClient().messages.create({
        model: cfg.model,
        max_tokens: 1024,
        thinking: { type: "adaptive" },
        output_config: { effort: cfg.effort },
        system:
          "You are a management analytics assistant for a university. Answer only using the provided " +
          "tools — never guess or estimate a figure yourself. Be concise and cite the numbers you found.",
        tools: TOOL_DEFS,
        messages,
      });
      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;
      messages = [...messages, { role: "assistant", content: response.content }];

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) {
        finalText = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const result = await runTool(tu.name, tu.input as Record<string, unknown>);
        toolCalls.push({ name: tu.name, result });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) });
      }
      messages = [...messages, { role: "user", content: toolResults }];
    }

    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      inputTokens: totalInput, outputTokens: totalOutput, latencyMs: Date.now() - startedAt, outcome: "OK",
    });
    return { answer: finalText || "I couldn't determine an answer from the available data.", toolCalls };
  } catch (err) {
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      latencyMs: Date.now() - startedAt, outcome: "ERROR", error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
