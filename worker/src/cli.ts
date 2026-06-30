// Load environment first — the db client reads DATABASE_URL when it is imported below.
import "$src/env";

import { parseArgs } from "node:util";

import { pool } from "@prompt-battle/db";

const COMMANDS = [
	"create",
	"ingest",
	"score",
	"advance",
	"reset",
	"delete",
	"publish",
	"status",
	"smoke"
] as const;
type Command = (typeof COMMANDS)[number];

const main = async () => {
	const { positionals } = parseArgs({ allowPositionals: true, strict: false });
	const command = positionals[0] as Command | undefined;

	switch (command) {
		case "create": {
			const { runCreate } = await import("$src/create");

			await runCreate();
			break;
		}
		case "ingest": {
			const { runIngest } = await import("$src/ingest");

			await runIngest();
			break;
		}
		case "score": {
			const { runScore } = await import("$src/score");

			await runScore();
			break;
		}
		case "advance": {
			const { runAdvance } = await import("$src/advance");

			await runAdvance();
			break;
		}
		case "reset": {
			const { runReset } = await import("$src/reset");

			await runReset();
			break;
		}
		case "delete": {
			const { runDelete } = await import("$src/delete");

			await runDelete();
			break;
		}
		case "publish": {
			const { runPublish } = await import("$src/publish");

			await runPublish();
			break;
		}
		case "status": {
			const { runStatus } = await import("$src/status");

			await runStatus();
			break;
		}
		case "smoke": {
			const { runSmoke } = await import("$src/smoke");

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
