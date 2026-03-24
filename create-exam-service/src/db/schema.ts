import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const test = sqliteTable("test", {
  id: text("id").primaryKey(),
});
