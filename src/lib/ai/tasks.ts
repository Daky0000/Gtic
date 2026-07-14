import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient } from "./providers/anthropic";
import { getFeatureConfig, logAICall, resolveProvider } from "./config";
import { uploadAsBase64 } from "@/lib/storage";

// ─── Document extraction (vision) — AP-08 ───

export const ExtractionSchema = z.object({
  candidateName: z.string().nullable(),
  indexNumber: z.string().nullable(),
  examYear: z.string().nullable(),
  subjects: z.array(z.object({ subject: z.string(), grade: z.string() })),
  notes: z.string().nullable(),
});
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

const MOCK_SUBJECTS = [
  { subject: "English Language", grade: "B2" },
  { subject: "Core Mathematics", grade: "B3" },
  { subject: "Integrated Science", grade: "A1" },
  { subject: "Physics", grade: "B2" },
  { subject: "Chemistry", grade: "B3" },
  { subject: "Elective Mathematics", grade: "B2" },
];

export async function extractApplicationDocument(opts: {
  userId: string;
  filePath: string;
  mimeType: string;
}): Promise<{ result: ExtractionResult; mocked: boolean }> {
  const FEATURE = "doc_extraction";
  const startedAt = Date.now();
  const cfg = await getFeatureConfig(FEATURE);
  const provider = resolveProvider(cfg);

  if (provider.name === "mock") {
    const result: ExtractionResult = {
      candidateName: null,
      indexNumber: null,
      examYear: String(new Date().getFullYear() - 1),
      subjects: MOCK_SUBJECTS,
      notes: "(mock AI) Simulated extraction — connect ANTHROPIC_API_KEY for real document reading.",
    };
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "mock", model: cfg.model,
      inputTokens: 200, outputTokens: 120, latencyMs: Date.now() - startedAt, outcome: "OK",
    });
    return { result, mocked: true };
  }

  try {
    const base64 = await uploadAsBase64(opts.filePath);
    const isPdf = opts.mimeType === "application/pdf";
    const response = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort, format: zodOutputFormat(ExtractionSchema) },
      messages: [
        {
          role: "user",
          content: [
            isPdf
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
              : { type: "image", source: { type: "base64", media_type: opts.mimeType as "image/png" | "image/jpeg", data: base64 } },
            {
              type: "text",
              text: "This is a scanned academic results slip or certificate. Extract the candidate's name, index number, examination year, and every subject with its grade, exactly as printed. If a field is not visible, use null.",
            },
          ],
        },
      ],
    });
    const result = response.parsed_output as ExtractionResult;
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startedAt, outcome: "OK",
    });
    return { result, mocked: false };
  } catch (err) {
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      latencyMs: Date.now() - startedAt, outcome: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── Admission eligibility pre-screen — ADM-06 ───

export const PrescreenSchema = z.object({
  requirementsMet: z.boolean(),
  summary: z.string(),
  flags: z.array(z.string()),
});
export type PrescreenResult = z.infer<typeof PrescreenSchema>;

const CREDIT_GRADES = new Set(["A1", "B2", "B3", "B4", "C4", "C5", "C6"]);

export async function prescreenApplication(opts: {
  userId?: string | null;
  programmeName: string;
  entryRequirements: string | null;
  qualificationType: string | null;
  results: { subject: string; grade: string }[];
  documentCount: number;
}): Promise<PrescreenResult> {
  const FEATURE = "prescreen";
  const startedAt = Date.now();
  const cfg = await getFeatureConfig(FEATURE);
  const provider = resolveProvider(cfg);

  if (provider.name === "mock") {
    const credits = opts.results.filter((r) => CREDIT_GRADES.has(r.grade.toUpperCase())).length;
    const flags: string[] = [];
    if (opts.documentCount === 0) flags.push("No supporting documents uploaded yet.");
    if (opts.results.length === 0) flags.push("No results have been entered on the application.");
    const requirementsMet = credits >= 6;
    if (!requirementsMet && opts.results.length > 0) {
      flags.push(`Only ${credits} credit-level passes recorded; most programmes expect at least 6.`);
    }
    const result: PrescreenResult = {
      requirementsMet,
      summary:
        `(mock AI) Applicant has ${opts.results.length} result(s) on file with ${credits} at credit level ` +
        `(A1–C6). Programme: ${opts.programmeName}. This is an advisory pre-screen — the admissions officer ` +
        `makes the actual decision.`,
      flags,
    };
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "mock", model: cfg.model,
      inputTokens: 150, outputTokens: 80, latencyMs: Date.now() - startedAt, outcome: "OK",
    });
    return result;
  }

  try {
    const response = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort, format: zodOutputFormat(PrescreenSchema) },
      system:
        "You are an admissions pre-screening assistant. You NEVER make the final admission decision — " +
        "you only assess whether the published entry requirements appear to be met from the data given, " +
        "and flag anything the human reviewer should look at (missing documents, inconsistent grades, " +
        "duplicate-looking entries). Be conservative: if unsure, flag it rather than assume it is fine.",
      messages: [
        {
          role: "user",
          content: [
            `Programme: ${opts.programmeName}`,
            `Published entry requirements: ${opts.entryRequirements ?? "(none published)"}`,
            `Applicant qualification type: ${opts.qualificationType ?? "unspecified"}`,
            `Applicant results: ${JSON.stringify(opts.results)}`,
            `Documents uploaded: ${opts.documentCount}`,
          ].join("\n"),
        },
      ],
    });
    const result = response.parsed_output as PrescreenResult;
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - startedAt, outcome: "OK",
    });
    return result;
  } catch (err) {
    await logAICall({
      userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model,
      latencyMs: Date.now() - startedAt, outcome: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
