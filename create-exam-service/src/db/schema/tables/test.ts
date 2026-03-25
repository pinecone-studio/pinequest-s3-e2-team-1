import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Жишээ / migration туршилт — хэрэггүй бол устгаж болно */
export const test = sqliteTable("test", {
	id: text("id").primaryKey(),
});
