import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import { getDb } from "./db";

export interface GraphQLContext {
  env: {
    DB: D1Database;
    GEMINI_API_KEY: string;
  };
  db: DrizzleD1Database<typeof schema>;
}

export const createContext = async (c: any): Promise<GraphQLContext> => {
  return {
    env: c.env,
    db: getDb(c.env.DB),
  };
};
