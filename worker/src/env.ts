import { config } from "dotenv";

// Load env from the repo-root .env whether the worker runs from the root or from worker/.
// On Railway the files are absent and the platform injects env vars — dotenv then no-ops.
// (Bun also auto-loads .env from the cwd; this is the explicit fallback for other cwds.)
config({ path: [".env", "../.env"], quiet: true });
