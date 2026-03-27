import { eq, sql } from "drizzle-orm";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { createId } from "./common";

export type TeacherSubmissionPayload = {
  attemptId: string;
  externalExamId: string;
  submittedAt: string;
  startedAt: string;
  expiresAt: string;
  sourceService: string;
  student: {
    id: string;
    name: string;
  };
  answers: Array<{
    questionId: string;
    selectedOptionId: string | null;
  }>;
};

const buildTeacherSubmissionPayload = async (
  db: DbClient,
  attemptId: string,
  submittedAt: string,
): Promise<{
  payload: TeacherSubmissionPayload;
  targetService: string;
  testId: string;
} | null> => {
  const attempt = await db.query.attempts.findFirst({
    where: eq(schema.attempts.id, attemptId),
  });

  if (!attempt) {
    throw new Error("Оролдлого олдсонгүй.");
  }

  const test = await db.query.tests.findFirst({
    where: eq(schema.tests.id, attempt.testId),
  });

  if (!test || test.answerKeySource !== "teacher_service") {
    return null;
  }

  const answers = await db.query.answers.findMany({
    where: eq(schema.answers.attemptId, attemptId),
  });

  return {
    testId: test.id,
    targetService: test.sourceService ?? "teacher-service",
    payload: {
      attemptId,
      externalExamId: test.generatorTestId,
      submittedAt,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      sourceService: test.sourceService ?? "teacher-service",
      student: {
        id: attempt.studentId,
        name: attempt.studentName,
      },
      answers: answers.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
      })),
    },
  };
};

const upsertTeacherSubmissionExport = async (
  db: DbClient,
  attemptId: string,
  testId: string,
  targetService: string,
  payloadJson: string,
  status: "pending" | "sent" | "failed",
  lastError?: string | null,
  sentAt?: string | null,
) => {
  await db
    .insert(schema.teacherSubmissionExports)
    .values({
      id: createId("teacher_sync"),
      attemptId,
      testId,
      targetService,
      status,
      payloadJson,
      lastError: lastError ?? null,
      sentAt: sentAt ?? null,
    })
    .onConflictDoUpdate({
      target: schema.teacherSubmissionExports.attemptId,
      set: {
        targetService,
        status,
        payloadJson,
        lastError: lastError ?? null,
        sentAt: sentAt ?? null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
};

export const syncAttemptSubmissionToTeacherService = async (
  db: DbClient,
  attemptId: string,
  submittedAt: string,
  submissionWebhookUrl?: string,
) => {
  const prepared = await buildTeacherSubmissionPayload(db, attemptId, submittedAt);

  if (!prepared) {
    return;
  }

  const payloadJson = JSON.stringify(prepared.payload);

  if (!submissionWebhookUrl) {
    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "pending",
    );
    return;
  }

  try {
    const response = await fetch(submissionWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payloadJson,
    });

    if (!response.ok) {
      throw new Error(`Teacher submission failed with status ${response.status}`);
    }

    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "sent",
      null,
      new Date().toISOString(),
    );
  } catch (error) {
    await upsertTeacherSubmissionExport(
      db,
      attemptId,
      prepared.testId,
      prepared.targetService,
      payloadJson,
      "failed",
      error instanceof Error ? error.message : "Teacher submission failed",
    );
  }
};
