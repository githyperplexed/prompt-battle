import { Latitude } from "@latitude-data/telemetry";

// Credentials-based opt-in: telemetry initializes whenever both Latitude env vars are present,
// independent of NODE_ENV. The scoring and bracket commands run locally by hand, so a
// production-only gate would never trace the runs that matter. With no provider registered the
// Vercel AI SDK falls back to a no-op tracer, so inference behaves identically when this is off.
//
// The constructor throws synchronously on an empty/whitespace key, and this runs at startup, so a
// bad value must degrade to no telemetry rather than abort a CLI run.
export const latitude = (() => {
	const apiKey = process.env.LATITUDE_API_KEY?.trim();
	const project = process.env.LATITUDE_PROJECT_SLUG?.trim();

	if (!apiKey || !project) {
		console.warn(
			"Latitude telemetry disabled (set LATITUDE_API_KEY and LATITUDE_PROJECT_SLUG to enable)"
		);

		return null;
	}

	try {
		const client = new Latitude({ apiKey, project });

		console.log(`Latitude telemetry enabled (project ${project})`);

		return client;
	} catch (err) {
		console.error("Latitude telemetry init failed; continuing without tracing:", err);

		return null;
	}
})();

// Flush buffered spans before the process exits. The batch span processor exports on a timer, so a
// short-lived CLI command would otherwise terminate before its traces leave the process.
export const shutdownTelemetry = async () => {
	if (!latitude) return;

	try {
		await latitude.shutdown();
	} catch (err) {
		console.warn("Latitude telemetry shutdown failed:", err);
	}
};
