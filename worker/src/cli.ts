// Load environment first — the db client reads DATABASE_URL when it is imported below.
import "$src/env";

import { parseArgs } from "node:util";

const COMMANDS = [
	"secret",
	"create",
	"ingest",
	"dq",
	"score",
	"cluster",
	"advance",
	"reset",
	"delete",
	"publish",
	"export",
	"verify",
	"status",
	"smoke",
	"judge"
] as const;
type Command = (typeof COMMANDS)[number];

// Only these commands make LLM calls, so only they register Latitude telemetry and pay the
// flush-on-exit cost. The rest stay free of any tracing setup.
const INFERENCE_COMMANDS = new Set<Command>(["score", "advance", "smoke", "judge"]);

// Commands that never open the database. `verify` must stay in this set: third parties run it
// against a downloaded bundle with no DATABASE_URL, so the db client must never be imported.
const OFFLINE_COMMANDS = new Set<Command>(["verify"]);

const main = async () => {
	const { positionals } = parseArgs({ allowPositionals: true, strict: false });
	const command = positionals[0] as Command | undefined;

	// Register the telemetry provider before inference runs, and flush it in the finally below so a
	// short-lived run never exits before its spans are exported.
	const telemetry =
		command && INFERENCE_COMMANDS.has(command) ? await import("$src/services/latitude") : null;

	try {
		switch (command) {
			case "secret": {
				const { runSecret } = await import("$src/secret");

				await runSecret();
				break;
			}
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
			case "dq": {
				const { runDq } = await import("$src/dq");

				await runDq();
				break;
			}
			case "score": {
				const { runScore } = await import("$src/score");

				await runScore();
				break;
			}
			case "cluster": {
				const { runCluster } = await import("$src/cluster");

				await runCluster();
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
			case "export": {
				const { runExport } = await import("$src/export");

				await runExport();
				break;
			}
			case "verify": {
				const { runVerify } = await import("$src/verify");

				await runVerify();
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
			case "judge": {
				const { runJudge } = await import("$src/judge");

				await runJudge();
				break;
			}
			default:
				console.log(`Usage: worker <${COMMANDS.join(" | ")}>`);
				if (command) process.exitCode = 1;
		}
	} finally {
		if (telemetry) await telemetry.shutdownTelemetry();

		// Every db-backed command exits cleanly by closing the pool — Railway's cron skips
		// overlapping runs, so the process must terminate to free the next scheduled tick. The
		// import is dynamic so offline commands never initialize the client.
		if (command && !OFFLINE_COMMANDS.has(command)) {
			const { pool } = await import("@prompt-battle/db");

			await pool.end();
		}
	}
};

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
