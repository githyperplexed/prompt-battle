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
