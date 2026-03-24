import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { listTests } from "@/lib/exam-service/store";

export const availableTests = async () => {
    const { env } = getCloudflareContext() as any;
    const db = createDb(env.DB);
    const tests = await listTests(db);
    return tests.map(t => ({
        ...t,
        criteria: {
            gradeLevel: t.gradeLevel,
            className: t.className,
            subject: t.subject,
            topic: t.topic,
            difficulty: "medium",
            questionCount: 0,
        }
    }));
};
