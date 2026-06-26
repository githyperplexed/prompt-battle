import { config } from "dotenv";

// Load the repo-root .env so the shared db client sees DATABASE_URL, mirroring the worker.
// This module must be imported before "@prompt-battle/db" — see server/database.ts.
config({ path: ["../.env", ".env"], quiet: true });
