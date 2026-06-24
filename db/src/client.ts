import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export { schema };

/** A connected Drizzle client plus the underlying pg pool (call `pool.end()` to shut down). */
export const createDb = (connectionString: string, options: { max?: number } = {}) => {
	const pool = new Pool({ connectionString, max: options.max ?? 15 });
	const db = drizzle(pool, { schema, casing: "snake_case" });
	return { db, pool };
};

export type Database = ReturnType<typeof createDb>["db"];

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

/** Default shared client, configured from `process.env.DATABASE_URL`. */
export const { db, pool } = createDb(connectionString);
