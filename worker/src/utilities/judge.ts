// A judge call that produces no schema-valid output (the AI SDK's NoOutputGeneratedError) is a
// content-driven refusal, not a transient network failure — the model declined rather than the
// request failing to reach it. Anything else (timeouts, 429s, 5xx) is transient and must stay
// retryable.
export const isNoOutputError = (err: unknown): boolean => {
	const name = (err as { name?: unknown } | null)?.name;

	return name === "AI_NoOutputGeneratedError" || name === "NoOutputGeneratedError";
};

// A real refusal repeats deterministically, so a few confirmations separate it from a rare
// sampling fluke. The pause between attempts keeps the confirmations from firing back-to-back
// inside a single rate-limiter slot.
export const REFUSAL_CONFIRMATIONS = 3;
export const REFUSAL_RETRY_DELAY_MS = 1_000;

export type RefusalOutcome<T> = { refused: false; value: T } | { refused: true; detail: string };

// Runs a judge call, retrying only no-output errors. A confirmed refusal is returned rather
// than thrown so the caller can resolve it (disqualify the entry, discard the vote); any other
// error rethrows on the first attempt and stays a transient, retryable failure.
export const withRefusalConfirmation = async <T>(
	call: () => Promise<T>,
	{ attempts = REFUSAL_CONFIRMATIONS, delayMs = REFUSAL_RETRY_DELAY_MS } = {}
): Promise<RefusalOutcome<T>> => {
	let lastDetail = "";

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		if (attempt > 1 && delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		try {
			return { refused: false, value: await call() };
		} catch (err) {
			if (!isNoOutputError(err)) throw err;

			lastDetail = err instanceof Error ? err.message : String(err);
		}
	}

	return { refused: true, detail: lastDetail };
};

// OpenRouter reports cost (USD) under providerMetadata.openrouter.usage.cost, but only when usage
// accounting is enabled on the request; tokens on `usage` are always present. Returns null when the
// figure is absent so the caller can fall back to the dashboard.
export const judgeCallCost = (audit: { providerMetadata?: unknown }): number | null => {
	const meta = audit.providerMetadata as { openrouter?: { usage?: { cost?: number } } } | undefined;
	const cost = meta?.openrouter?.usage?.cost;

	return typeof cost === "number" ? cost : null;
};

export const formatJudgeCost = (cost: number | null): string =>
	cost === null ? "not reported (see OpenRouter dashboard)" : `$${cost.toFixed(6)}`;

// The judge instructions are identical on every call, so they go in a cache-marked system
// message (providers that support it reuse the prefix). The messages carry our own trusted
// system prompt — not user input — so allowSystemInMessages is safe at the call sites.
export const buildJudgeMessages = (system: string, user: string) => [
	{
		role: "system" as const,
		content: system,
		providerOptions: { openrouter: { cacheControl: { type: "ephemeral" } } }
	},
	{ role: "user" as const, content: user }
];
