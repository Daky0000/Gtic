"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { askAnalyticsQuestion } from "@/lib/ai/analytics";

export async function askAnalyticsQuestionAction(formData: FormData) {
  const user = await requireUser();
  const question = String(formData.get("question") ?? "").trim();
  if (!question) redirect("/staff/reports");

  let conversation = await db.aIConversation.findFirst({
    where: { userId: user.id, feature: "analytics" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await db.aIConversation.create({ data: { userId: user.id, feature: "analytics", title: "Analytics" } });
  }

  const { answer, toolCalls } = await askAnalyticsQuestion({ userId: user.id, question });

  await db.aIMessage.createMany({
    data: [
      { conversationId: conversation.id, role: "USER", content: question },
      {
        conversationId: conversation.id, role: "ASSISTANT", content: answer,
        citations: toolCalls.length > 0 ? JSON.parse(JSON.stringify(toolCalls)) : undefined,
      },
    ],
  });

  redirect("/staff/reports");
}
