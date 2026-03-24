import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { savePublishedTest, startExamAttempt, submitExamAnswers, approveAttempt } from "@/lib/exam-service/store";

export const mutations = {
    saveTest: async (_: any, { test }: { test: string }) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        const mockTest = JSON.parse(test);
        await savePublishedTest(db, mockTest);
        return true;
    },
    startExam: async (_: any, { testId, studentId, studentName }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        return startExamAttempt(db, testId, studentId, studentName);
    },
    submitAnswers: async (_: any, { attemptId, answers, finalize }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        return submitExamAnswers(db, attemptId, answers, finalize);
    },
    approveAttempt: async (_: any, { attemptId }: any) => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        await approveAttempt(db, attemptId);
        return true;
    },
};
