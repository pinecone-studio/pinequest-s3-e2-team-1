import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Ирээдүйд draft / батлагдсан шалгалт хадгалах хүснэгтийн загвар.
 * `drizzle-kit generate` ажиллуулахад migration үүснэ.
 */
export const exams = sqliteTable("exams", {
	id: text("id").primaryKey(),
	status: text("status").notNull(),
	payloadJson: text("payload_json").notNull(),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
