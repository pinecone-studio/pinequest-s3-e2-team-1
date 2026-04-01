import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { examVariantJobs } from "./examVariantJobs";
import { newExams } from "./newExams";

export const examVariants = sqliteTable("exam_variants", {
	id: text("id").primaryKey(),
	jobId: text("job_id")
		.notNull()
		.references(() => examVariantJobs.id, { onDelete: "cascade" }),
	examId: text("exam_id").references(() => newExams.id, { onDelete: "set null" }),
	variantNumber: integer("variant_number").notNull(),
	title: text("title").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
