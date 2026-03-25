import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { getDb } from "../db";

export interface GraphQLContext {
	env: {
		DB?: D1Database;
		GEMINI_API_KEY?: string;
	};
	db: DrizzleD1Database<typeof schema> | null;
}

export async function createGraphQLContext(): Promise<GraphQLContext> {
	const { env } = await getCloudflareContext();
	const e = env as CloudflareEnv & { DB?: D1Database; GEMINI_API_KEY?: string };
	return {
		env: {
			DB: e.DB,
			GEMINI_API_KEY: e.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY,
		},
		db: e.DB ? getDb(e.DB) : null,
	};
}
