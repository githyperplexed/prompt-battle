// Load environment first — the db client reads DATABASE_URL when it is imported below.
import "./env";

import { parseArgs } from "node:util";

import { pool } from "@prompt-battle/db";

const COMMANDS = ["ingest", "score", "advance", "smoke"] as const;
type Command = (typeof COMMANDS)[number];

const main = async () => {
	const { positionals } = parseArgs({ allowPositionals: true, strict: false });
	const command = positionals[0] as Command | undefined;

	switch (command) {
		case "ingest":
			console.log(
				"[ingest] stub — snapshots YouTube comments into entries (--contest <id> | --due)"
			);
			break;
		case "score":
			console.log("[score] stub — runs the absolute scoring pass");
			break;
		case "advance":
			console.log("[advance] stub — runs the bracket");
			break;
		case "smoke": {
			// Lazy import so only this path requires OPENROUTER_API_KEY (ingest must not).
			const { runSmoke } = await import("./smoke");

			await runSmoke();
			break;
		}
		default:
			console.log(`Usage: worker <${COMMANDS.join(" | ")}>`);
			if (command) process.exitCode = 1;
	}
};

// Every command exits cleanly by closing the pool — Railway's cron skips overlapping runs,
// so the process must terminate to free the next scheduled tick.
main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => pool.end());
