"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, ROLES } from "@/lib/rbac";
import { saveUpload, uploadRejection } from "@/lib/storage";
import { draftQuizQuestions, suggestSubmissionScore } from "@/lib/ai/tasks";
import type { MaterialKind } from "@prisma/client";

async function assertLecturer(offeringId: string, userId: string) {
  const offering = await db.courseOffering.findUniqueOrThrow({
    where: { id: offeringId },
    include: { lecturers: true },
  });
  const isAssigned = offering.lecturers.some((l) => l.staffUserId === userId);
  const isAdmin = (await db.roleAssignment.findFirst({
    where: { userId, role: { code: ROLES.SYSTEM_ADMIN } },
  })) != null;
  if (!isAssigned && !isAdmin) throw new Error("You are not assigned to this course.");
  return offering;
}

// ─── Materials ───

export async function addMaterial(formData: FormData) {
  const user = await requireUser();
  const offeringId = String(formData.get("offeringId"));
  await assertLecturer(offeringId, user.id);

  const kind = String(formData.get("kind")) as MaterialKind;
  const title = String(formData.get("title"));
  const week = formData.get("week") ? Number(formData.get("week")) : null;

  if (kind === "FILE") {
    const file = formData.get("file") as File | null;
    if (!file) throw new Error("Choose a file to upload.");
    const rejection = uploadRejection(file);
    if (rejection) throw new Error(rejection);
    const saved = await saveUpload(file, `materials/${offeringId}`);
    await db.material.create({ data: { offeringId, title, kind, week, filePath: saved.filePath, createdById: user.id } });
  } else {
    const content = String(formData.get("content") ?? "");
    await db.material.create({ data: { offeringId, title, kind, week, content, createdById: user.id } });
  }

  redirect(`/staff/courses/${offeringId}/elearning`);
}

// ─── Assignments ───

export async function createAssignment(formData: FormData) {
  const user = await requireUser();
  const offeringId = String(formData.get("offeringId"));
  await assertLecturer(offeringId, user.id);

  await db.assignment.create({
    data: {
      offeringId,
      title: String(formData.get("title")),
      instructions: String(formData.get("instructions")),
      dueAt: new Date(String(formData.get("dueAt"))),
      maxScore: Number(formData.get("maxScore") ?? 100),
    },
  });
  redirect(`/staff/courses/${offeringId}/elearning`);
}

export async function submitAssignment(formData: FormData) {
  const user = await requireUser();
  const assignmentId = String(formData.get("assignmentId"));
  const student = await db.student.findUniqueOrThrow({ where: { userId: user.id } });
  const assignment = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });

  if (new Date() > assignment.dueAt) {
    redirect(`/student/elearning/${assignment.offeringId}?error=${encodeURIComponent("The deadline for this assignment has passed.")}`);
  }

  const text = String(formData.get("text") ?? "");
  await db.submission.upsert({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    update: { text, submittedAt: new Date() },
    create: { assignmentId, studentId: student.id, text },
  });
  redirect(`/student/elearning/${assignment.offeringId}`);
}

export async function requestAiGradeSuggestion(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId"));
  const submission = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { assignment: { include: { offering: true } } },
  });
  await assertLecturer(submission.assignment.offeringId, user.id);

  const suggestion = await suggestSubmissionScore({
    userId: user.id,
    instructions: submission.assignment.instructions,
    maxScore: submission.assignment.maxScore,
    submissionText: submission.text ?? "",
  });
  await db.submission.update({ where: { id: submissionId }, data: { aiSuggestion: JSON.parse(JSON.stringify(suggestion)) } });
  redirect(`/staff/courses/${submission.assignment.offeringId}/elearning`);
}

export async function gradeSubmission(formData: FormData) {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId"));
  const offeringId = String(formData.get("offeringId"));
  await assertLecturer(offeringId, user.id);

  const score = Number(formData.get("score"));
  const feedback = String(formData.get("feedback") ?? "");
  await db.submission.update({
    where: { id: submissionId },
    data: { score, feedback, gradedAt: new Date() },
  });
  redirect(`/staff/courses/${offeringId}/elearning`);
}

// ─── Quizzes ───

export async function createQuiz(formData: FormData) {
  const user = await requireUser();
  const offeringId = String(formData.get("offeringId"));
  await assertLecturer(offeringId, user.id);

  const quiz = await db.quiz.create({
    data: { offeringId, title: String(formData.get("title")), durationMin: formData.get("durationMin") ? Number(formData.get("durationMin")) : null },
  });
  redirect(`/staff/courses/${offeringId}/quizzes/${quiz.id}`);
}

export async function addQuizQuestionsFromAi(formData: FormData) {
  const user = await requireUser();
  const quizId = String(formData.get("quizId"));
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { offering: { include: { course: true, materials: true } } } });
  await assertLecturer(quiz.offeringId, user.id);

  const questions = await draftQuizQuestions({
    userId: user.id,
    courseTitle: quiz.offering.course.title,
    materialsText: quiz.offering.materials.map((m) => `${m.title}: ${m.content ?? ""}`).join("\n"),
  });

  const existingCount = await db.quizQuestion.count({ where: { quizId } });
  await db.quizQuestion.createMany({
    data: questions.map((q, i) => ({
      quizId, ord: existingCount + i, prompt: q.prompt,
      options: JSON.parse(JSON.stringify(q.options)), correctIndex: q.correctIndex,
    })),
  });
  redirect(`/staff/courses/${quiz.offeringId}/quizzes/${quizId}`);
}

export async function addQuizQuestionManual(formData: FormData) {
  const user = await requireUser();
  const quizId = String(formData.get("quizId"));
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
  await assertLecturer(quiz.offeringId, user.id);

  const options = [1, 2, 3, 4].map((i) => String(formData.get(`option_${i}`) ?? "")).filter(Boolean);
  const correctIndex = Number(formData.get("correctIndex"));
  const ord = await db.quizQuestion.count({ where: { quizId } });

  await db.quizQuestion.create({
    data: { quizId, ord, prompt: String(formData.get("prompt")), options, correctIndex },
  });
  redirect(`/staff/courses/${quiz.offeringId}/quizzes/${quizId}`);
}

export async function publishQuiz(formData: FormData) {
  const user = await requireUser();
  const quizId = String(formData.get("quizId"));
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId } });
  await assertLecturer(quiz.offeringId, user.id);

  const count = await db.quizQuestion.count({ where: { quizId } });
  if (count === 0) throw new Error("Add at least one question before publishing.");

  await db.quiz.update({ where: { id: quizId }, data: { published: true } });
  redirect(`/staff/courses/${quiz.offeringId}/quizzes/${quizId}`);
}

export async function submitQuizAttempt(formData: FormData) {
  const user = await requireUser();
  const quizId = String(formData.get("quizId"));
  const student = await db.student.findUniqueOrThrow({ where: { userId: user.id } });
  const quiz = await db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { questions: true } });

  if (!quiz.published) {
    redirect(`/student/elearning/${quiz.offeringId}?error=${encodeURIComponent("This quiz is not open yet.")}`);
  }
  const prior = await db.quizAttempt.findUnique({
    where: { quizId_studentId: { quizId, studentId: student.id } },
  });
  if (prior?.submittedAt) {
    redirect(`/student/elearning/${quiz.offeringId}?error=${encodeURIComponent("You have already submitted this quiz — one attempt only.")}`);
  }

  const answers = quiz.questions.map((q) => Number(formData.get(`q_${q.id}`)));
  const maxPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
  const earned = quiz.questions.reduce((s, q, i) => s + (answers[i] === q.correctIndex ? q.points : 0), 0);
  const score = maxPoints > 0 ? (earned / maxPoints) * 100 : 0;

  await db.quizAttempt.upsert({
    where: { quizId_studentId: { quizId, studentId: student.id } },
    update: { submittedAt: new Date(), answers, score },
    create: { quizId, studentId: student.id, submittedAt: new Date(), answers, score },
  });
  redirect(`/student/elearning/${quiz.offeringId}`);
}

