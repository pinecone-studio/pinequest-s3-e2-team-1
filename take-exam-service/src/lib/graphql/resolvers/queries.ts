import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { seedStudents } from "@/lib/db/seed";
import { listTests, listAttempts } from "@/lib/exam-service/store";

export const queries = {
    students: async () => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        let all = await db.select().from(students);
        if (all.length === 0) {
            await seedStudents(db);
            all = await db.select().from(students);
        }
        return all;
    },
    availableTests: async () => {
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
                difficulty: "medium", // matching schema
                questionCount: 0,
            }
        }));
    },
    attempts: async () => {
        const { env } = getCloudflareContext() as any;
        const db = createDb(env.DB);
        return listAttempts(db);
    },
};
