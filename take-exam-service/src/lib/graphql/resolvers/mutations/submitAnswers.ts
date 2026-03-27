import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import type { ExamAnswerInput } from "@/lib/exam-service/types";
import { submitExamAnswers } from "@/lib/exam-service/store";

type SubmitAnswersArgs = {
    attemptId: string;
    answers: ExamAnswerInput[];
    finalize: boolean;
};

type ResolverEnv = {
    DB: D1Database;
    EXAM_CACHE?: KVNamespace;
    EXAM_SUBMISSION_QUEUE?: Queue<unknown>;
    TEACHER_SUBMISSION_WEBHOOK_URL?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    AI?: {
        run: (
            model: string,
            input: {
                messages: Array<{ role: "system" | "user"; content: string }>;
                response_format?: { type: "json_object" };
            },
        ) => Promise<{ response?: string }>;
    };
};

export const submitAnswers = async (_: unknown, { attemptId, answers, finalize }: SubmitAnswersArgs) => {
    const { env } = getCloudflareContext() as unknown as { env: ResolverEnv };
    const db = createDb(env.DB);
    return submitExamAnswers(
        db,
        attemptId,
        answers,
        finalize,
        env.EXAM_SUBMISSION_QUEUE,
        env.EXAM_CACHE,
        env.TEACHER_SUBMISSION_WEBHOOK_URL,
        env.AI,
        env.GEMINI_API_KEY,
        env.GEMINI_MODEL,
    );
};
