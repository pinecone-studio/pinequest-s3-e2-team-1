import { sql, eq, and, desc } from "drizzle-orm";
import type {
	AttemptSummary,
	ExamAnswerInput,
	ExamProgress,
	ExamQuestionResult,
	ExamResultSummary,
	GetProgressResponse,
	MockTest,
	StartExamResponse,
	SubmitAnswersResponse,
	StudentInfo,
} from "@shared/contracts/mock-exam";
import { shuffleWithSeed } from "@/lib/exam-service/shuffle";
import { DbClient } from "@/lib/db";
import * as schema from "@/lib/db/schema";

const createId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

// Internal helpers
const computeProgress = (answersCount: number, totalQuestions: number): ExamProgress => ({
	totalQuestions,
	answeredQuestions: answersCount,
	remainingQuestions: totalQuestions - answersCount,
	completionRate: totalQuestions === 0 ? 0 : Math.round((answersCount / totalQuestions) * 100),
});

export const savePublishedTest = async (db: DbClient, test: MockTest) => {
	await db.insert(schema.tests).values({
		id: test.id,
		generatorTestId: test.id,
		title: test.title,
		description: test.description,
		gradeLevel: test.criteria.gradeLevel,
		className: test.criteria.className,
		topic: test.criteria.topic,
		subject: test.criteria.subject,
		timeLimitMinutes: test.timeLimitMinutes,
		status: "published",
	}).onConflictDoUpdate({
		target: schema.tests.id,
		set: {
			title: test.title,
			description: test.description,
			updatedAt: sql`CURRENT_TIMESTAMP`,
		}
	});

	// Save questions
	for (const [idx, q] of test.questions.entries()) {
		await db.insert(schema.questions).values({
			id: q.id,
			testId: test.id,
			prompt: q.prompt,
			options: JSON.stringify(q.options),
			correctOptionId: q.correctOptionId,
			explanation: q.explanation,
			points: q.points,
			competency: q.competency,
			orderSlot: idx,
		}).onConflictDoUpdate({
			target: schema.questions.id,
			set: {
				prompt: q.prompt,
				options: JSON.stringify(q.options),
				correctOptionId: q.correctOptionId,
			}
		});
	}
};

export const startExamAttempt = async (db: DbClient, testId: string, studentId: string, studentName: string) => {
	const test = await db.query.tests.findFirst({
		where: eq(schema.tests.id, testId),
	});

	if (!test) throw new Error("Шалгалт олдсонгүй.");

	const testQuestions = await db.query.questions.findMany({
		where: eq(schema.questions.testId, testId),
		orderBy: [schema.questions.orderSlot],
	});

	const attemptId = createId("attempt");
	const startedAt = new Date().toISOString();
	const expiresAt = new Date(Date.now() + test.timeLimitMinutes * 60_000).toISOString();

	// Create attempt record
	await db.insert(schema.attempts).values({
		id: attemptId,
		testId,
		studentId: studentId.trim(),
		studentName: studentName.trim(),
		status: "in_progress",
		startedAt,
		expiresAt,
	});

	// Initialize empty answers for all questions
	for (const q of testQuestions) {
		await db.insert(schema.answers).values({
			attemptId,
			questionId: q.id,
			selectedOptionId: null,
		});
	}

	// Shuffle logic for response
	const questionSeed = `${testId}:${studentId}:${attemptId}:questions`;
	const shuffledQuestions = shuffleWithSeed(testQuestions, questionSeed).map((q, idx) => ({
		questionId: q.id,
		type: "single-choice" as const,
		prompt: q.prompt,
		options: shuffleWithSeed(JSON.parse(q.options), `${attemptId}:${q.id}:options:${idx}`),
		points: q.points,
		competency: q.competency,
	}));

	return {
		attemptId,
		status: "in_progress" as const,
		studentId,
		studentName,
		startedAt,
		expiresAt,
		exam: {
			testId,
			title: test.title,
			description: test.description,
			criteria: {
				gradeLevel: test.gradeLevel,
				className: test.className,
				subject: test.subject,
				topic: test.topic,
				difficulty: "medium" as any, // fallback
				questionCount: testQuestions.length,
			},
			timeLimitMinutes: test.timeLimitMinutes,
			questions: shuffledQuestions,
		},
		progress: computeProgress(0, testQuestions.length),
	};
};

export const submitExamAnswers = async (db: DbClient, attemptId: string, inputAnswers: ExamAnswerInput[], finalize = false): Promise<SubmitAnswersResponse> => {
	const attempt = await db.query.attempts.findFirst({
		where: eq(schema.attempts.id, attemptId),
	});

	if (!attempt) throw new Error("Оролдлого олдсонгүй.");
	if (attempt.status === "submitted" || attempt.status === "approved") {
		// Return current state if already submitted
		const qResults = await getAttemptResults(db, attemptId);
		return {
			attemptId,
			status: attempt.status,
			progress: computeProgress(qResults.filter(r => r.selectedOptionId).length, qResults.length),
			result: finalize ? computeResult(qResults) : undefined,
		};
	}

	// Update individual answers
	for (const ans of inputAnswers) {
		await db.update(schema.answers)
			.set({ selectedOptionId: ans.selectedOptionId })
			.where(and(eq(schema.answers.attemptId, attemptId), eq(schema.answers.questionId, ans.questionId)));
	}

	let status = attempt.status;
	let result: ExamResultSummary | undefined;

	if (finalize) {
		const qResults = await getAttemptResults(db, attemptId);
		result = computeResult(qResults);
		status = "submitted";

		await db.update(schema.attempts)
			.set({
				status,
				submittedAt: new Date().toISOString(),
				score: result.score,
				maxScore: result.maxScore,
				percentage: result.percentage,
			})
			.where(eq(schema.attempts.id, attemptId));
	}

	const currentQResults = await getAttemptResults(db, attemptId);

	return {
		attemptId,
		status,
		progress: computeProgress(currentQResults.filter(r => r.selectedOptionId).length, currentQResults.length),
		result,
	};
};

const getAttemptResults = async (db: DbClient, attemptId: string) => {
	const data = await db.select({
		questionId: schema.questions.id,
		selectedOptionId: schema.answers.selectedOptionId,
		correctOptionId: schema.questions.correctOptionId,
		explanation: schema.questions.explanation,
		points: schema.questions.points,
	})
		.from(schema.answers)
		.innerJoin(schema.questions, eq(schema.answers.questionId, schema.questions.id))
		.where(eq(schema.answers.attemptId, attemptId));

	return data;
};

const computeResult = (questions: any[]): ExamResultSummary => {
	const questionResults: ExamQuestionResult[] = questions.map(q => ({
		questionId: q.questionId,
		selectedOptionId: q.selectedOptionId,
		correctOptionId: q.correctOptionId,
		isCorrect: q.selectedOptionId === q.correctOptionId,
		pointsAwarded: q.selectedOptionId === q.correctOptionId ? q.points : 0,
		maxPoints: q.points,
		explanation: q.explanation,
	}));

	const score = questionResults.reduce((t, r) => t + r.pointsAwarded, 0);
	const maxScore = questionResults.reduce((t, r) => t + r.maxPoints, 0);

	return {
		score,
		maxScore,
		percentage: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
		correctCount: questionResults.filter(r => r.isCorrect).length,
		incorrectCount: questionResults.filter(r => r.selectedOptionId !== null && !r.isCorrect).length,
		unansweredCount: questionResults.filter(r => r.selectedOptionId === null).length,
		questionResults,
	};
};

export const listAttempts = async (db: DbClient): Promise<AttemptSummary[]> => {
	const records = await db.query.attempts.findMany({
		orderBy: [desc(schema.attempts.startedAt)],
	});

	const summaries: AttemptSummary[] = [];

	for (const r of records) {
		const test = await db.query.tests.findFirst({ where: eq(schema.tests.id, r.testId) });
		const qResults = r.status !== "in_progress" ? await getAttemptResults(db, r.id) : [];

		summaries.push({
			attemptId: r.id,
			testId: r.testId,
			title: test?.title || "Unknown Test",
			studentId: r.studentId,
			studentName: r.studentName,
			status: r.status,
			score: r.score ?? undefined,
			maxScore: r.maxScore ?? undefined,
			percentage: r.percentage ?? undefined,
			startedAt: r.startedAt,
			submittedAt: r.submittedAt ?? undefined,
			result: r.status !== "in_progress" ? computeResult(qResults) : undefined,
		});
	}

	return summaries;
};

export const approveAttempt = async (db: DbClient, attemptId: string) => {
	await db.update(schema.attempts)
		.set({ status: "approved" })
		.where(and(eq(schema.attempts.id, attemptId), eq(schema.attempts.status, "submitted")));
};

export const listTests = async (db: DbClient) => {
	return db.query.tests.findMany({
		orderBy: [desc(schema.tests.updatedAt)],
	});
};
