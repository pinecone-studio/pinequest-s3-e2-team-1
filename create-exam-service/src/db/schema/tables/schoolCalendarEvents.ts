import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

/**
 * Сургуулийн нэгдсэн календарийн эвент (академик, захиргаа, амьдрал, нөөцийн хязгаарлалт).
 * Single source of truth: D1 → GraphQL → frontend.
 */
export const schoolCalendarEvents = sqliteTable("school_calendar_events", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),
	title: text("title").notNull(),
	description: text("description"),
	/** ACADEMIC | ADMIN | CAMPUS_LIFE | RESOURCE_CONSTRAINT */
	category: text("category").notNull(),
	/**
	 * UI дэд давхарга: holiday | admin_fixed | resource_lock | academic_milestone
	 * (амралт/баяр, захиргаа/хурал, нөөц түгжээ, академик milestone).
	 */
	layerKind: text("layer_kind").notNull().default("academic_milestone"),
	subcategory: text("subcategory"),
	startTime: integer("start_time", { mode: "timestamp" }).notNull(),
	endTime: integer("end_time", { mode: "timestamp" }).notNull(),
	allDay: integer("all_day", { mode: "boolean" }).notNull().default(false),
	/** SCHOOL_WIDE | TEACHERS | PUBLIC */
	visibility: text("visibility").notNull().default("SCHOOL_WIDE"),
	metadataJson: text("metadata_json"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});
