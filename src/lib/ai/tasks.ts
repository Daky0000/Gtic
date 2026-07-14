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

// ─── Grading assistance — LEC-07 (advisory only; lecturer approves every score) ───

export const GradeSuggestionSchema = z.object({
  suggestedScore: z.number(),
  rationale: z.string(),
});
export type GradeSuggestion = z.infer<typeof GradeSuggestionSchema>;

export async function suggestSubmissionScore(opts: {
  userId: string;
  instructions: string;
  maxScore: number;
  submissionText: string;
}): Promise<GradeSuggestion> {
  const FEATURE = "grading_assist";
  const startedAt = Date.now();
  const cfg = await getFeatureConfig(FEATURE);
  const provider = resolveProvider(cfg);

  if (provider.name === "mock") {
    // Deterministic stand-in: reward answers that engage substantively with
    // the assignment (length as a rough proxy) without pretending to mark content.
    const words = opts.submissionText.trim().split(/\s+/).filter(Boolean).length;
    const ratio = Math.min(1, words / 120);
    const score = Math.round(opts.maxScore * (0.5 + 0.4 * ratio) * 10) / 10;
    const result: GradeSuggestion = {
      suggestedScore: score,
      rationale:
        `(mock AI) The answer runs to ${words} words and addresses the prompt at a basic level. ` +
        `This is a rough length-based estimate, not a real content assessment — review the answer yourself before scoring.`,
    };
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "mock", model: cfg.model, inputTokens: 120, outputTokens: 60, latencyMs: Date.now() - startedAt, outcome: "OK" });
    return result;
  }

  try {
    const response = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort, format: zodOutputFormat(GradeSuggestionSchema) },
      system:
        `You assist a lecturer in marking a student answer against the assignment instructions and a ` +
        `maximum score of ${opts.maxScore}. You suggest a score and a short rationale. You NEVER finalize ` +
        `the grade — the lecturer always reviews and can override your suggestion.`,
      messages: [
        { role: "user", content: `Assignment instructions:\n${opts.instructions}\n\nStudent answer:\n${opts.submissionText}` },
      ],
    });
    const result = response.parsed_output as GradeSuggestion;
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, latencyMs: Date.now() - startedAt, outcome: "OK" });
    return result;
  } catch (err) {
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model, latencyMs: Date.now() - startedAt, outcome: "ERROR", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ─── Quiz question drafting — LEC-06 (lecturer edits and approves before publishing) ───

export const QuizDraftSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string(),
    options: z.array(z.string()).length(4),
    correctIndex: z.number().int().min(0).max(3),
  })).length(3),
});
export type QuizDraft = z.infer<typeof QuizDraftSchema>;

const MOCK_QUESTIONS: QuizDraft["questions"] = [
  {
    prompt: "(mock AI) Which of these is NOT typically covered in an introductory course on this topic?",
    options: ["Core definitions", "Foundational principles", "Advanced doctoral-level research frontiers", "Worked examples"],
    correctIndex: 2,
  },
  {
    prompt: "(mock AI) What is generally the best first step when approaching a new problem in this subject?",
    options: ["Guess the answer", "Understand the requirements and given information", "Skip to the conclusion", "Ignore the instructions"],
    correctIndex: 1,
  },
  {
    prompt: "(mock AI) Which practice most improves understanding of this course's material?",
    options: ["Working through practice problems", "Memorizing without practice", "Avoiding past questions", "Skipping lectures"],
    correctIndex: 0,
  },
];

export async function draftQuizQuestions(opts: {
  userId: string;
  courseTitle: string;
  materialsText: string;
}): Promise<QuizDraft["questions"]> {
  const FEATURE = "quiz_generation";
  const startedAt = Date.now();
  const cfg = await getFeatureConfig(FEATURE);
  const provider = resolveProvider(cfg);

  if (provider.name === "mock") {
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "mock", model: cfg.model, inputTokens: 100, outputTokens: 90, latencyMs: Date.now() - startedAt, outcome: "OK" });
    return MOCK_QUESTIONS;
  }

  try {
    const response = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: { effort: cfg.effort, format: zodOutputFormat(QuizDraftSchema) },
      system:
        "You draft multiple-choice quiz questions (4 options each, exactly one correct) from the given " +
        "course materials. These are a DRAFT — the lecturer will review, edit and approve every question " +
        "before students ever see them.",
      messages: [
        { role: "user", content: `Course: ${opts.courseTitle}\n\nMaterials:\n${opts.materialsText || "(no materials text provided)"}` },
      ],
    });
    const result = response.parsed_output as QuizDraft;
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, latencyMs: Date.now() - startedAt, outcome: "OK" });
    return result.questions;
  } catch (err) {
    await logAICall({ userId: opts.userId, feature: FEATURE, provider: "anthropic", model: cfg.model, latencyMs: Date.now() - startedAt, outcome: "ERROR", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
