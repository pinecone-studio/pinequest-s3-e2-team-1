import { desc, eq } from "drizzle-orm";
import type { AttemptSummary } from "@/lib/exam-service/types";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { getAttemptMonitoringSummaries } from "./activity";
import { computeProgress } from "./common";
import { parseAttemptFeedback } from "./feedback";
import { parseStoredTeacherResult } from "./teacher-sync";
import {
	cacheAttemptState,
	getAttemptStateFromKv,
	resolveAttemptState,
} from "./cache";
import { computeResult, getAttemptAnswerReview, getAttemptResults } from "./results";

export const listAttempts = async (
	db: DbClient,
	kv?: KVNamespace,
): Promise<AttemptSummary[]> => {
	const records = await db.query.attempts.findMany({
		orderBy: [desc(schema.attempts.startedAt)],
	});
	const monitoringByAttemptId = await getAttemptMonitoringSummaries(
		db,
		records.map((record) => record.id),
	);

	const summaries: AttemptSummary[] = [];

	for (const record of records) {
			const test = await db.query.tests.findFirst({
				where: eq(schema.tests.id, record.testId),
			});
			const teacherSyncExport = await db.query.teacherSubmissionExports.findFirst({
				where: eq(schema.teacherSubmissionExports.attemptId, record.id),
			});
			const attemptState = await resolveAttemptState(db, record.id, kv);
			const answeredQuestions = Object.values(attemptState.answers).filter(Boolean).length;
			const answerKeySource = test?.answerKeySource ?? "local";
			const teacherCheckedResult = parseStoredTeacherResult(record.teacherResultJson);
			const hasReviewableAnswers =
				answerKeySource === "local" &&
				(record.status === "submitted" || record.status === "approved");
			const resultRows = hasReviewableAnswers
				? await getAttemptResults(db, record.id)
				: [];
			const answerReview = await getAttemptAnswerReview(db, record.id);
			const result =
				answerKeySource === "teacher_service"
					? teacherCheckedResult
					: hasReviewableAnswers
						? computeResult(resultRows)
						: undefined;
		const isApproved = record.status === "approved";

		summaries.push({
			attemptId: record.id,
				testId: record.testId,
				title: test?.title || "Unknown Test",
				studentId: record.studentId,
				studentName: record.studentName,
				status: record.status,
				answerKeySource,
				criteria: test
				? {
						gradeLevel: test.gradeLevel,
							className: test.className,
							subject: test.subject,
							topic: test.topic,
							difficulty: "medium",
							questionCount: attemptState.totalQuestions,
						}
					: undefined,
				progress: computeProgress(answeredQuestions, attemptState.totalQuestions),
				score: isApproved ? record.score ?? undefined : undefined,
				maxScore: isApproved ? record.maxScore ?? undefined : undefined,
				percentage: isApproved ? record.percentage ?? undefined : undefined,
				startedAt: record.startedAt,
				submittedAt: record.submittedAt ?? undefined,
				result,
				answerReview,
				feedback: parseAttemptFeedback(record.feedbackJson),
				monitoring: monitoringByAttemptId.get(record.id),
				teacherSync: teacherSyncExport
					? {
							status: teacherSyncExport.status,
							targetService: teacherSyncExport.targetService,
							lastError: teacherSyncExport.lastError ?? undefined,
							sentAt: teacherSyncExport.sentAt ?? undefined,
						}
					: undefined,
			});
	}

	return summaries;
};

export const approveAttempt = async (
	db: DbClient,
	attemptId: string,
	kv?: KVNamespace,
) => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status === "approved") return;
	if (attempt.status !== "submitted") {
		throw new Error("Зөвхөн илгээгдсэн шалгалтыг батлах боломжтой.");
	}

	const test = await db.query.tests.findFirst({
		where: eq(schema.tests.id, attempt.testId),
	});
	if (test?.answerKeySource === "teacher_service") {
		throw new Error(
			"Энэ шалгалтын зөв хариулт багшийн талд байгаа тул эндээс approve хийхгүй.",
		);
	}

	const resultRows = await getAttemptResults(db, attemptId);
	const result = computeResult(resultRows);

	await db.update(schema.attempts)
		.set({
			status: "approved",
			score: result.score,
			maxScore: result.maxScore,
			percentage: result.percentage,
		})
		.where(eq(schema.attempts.id, attemptId));

	const cachedState = await getAttemptStateFromKv(kv, attemptId);
	if (cachedState) {
		await cacheAttemptState(kv, {
			...cachedState,
			status: "approved",
		});
	}
};
