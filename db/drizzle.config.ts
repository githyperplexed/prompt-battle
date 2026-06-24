import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load DATABASE_URL from the repo-root .env, whether drizzle-kit runs from root or db/.
config({ path: [".env", "../.env"] });

export default defineConfig({
	schema: "./src/schema/index.ts",
	out: "./drizzle",
	dialect: "postgresql",
	casing: "snake_case",
	dbCredentials: { url: process.env.DATABASE_URL! },
	verbose: true,
	strict: true
});
