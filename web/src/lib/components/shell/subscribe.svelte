<script lang="ts">
	// Posts to the hyperplexed.io list endpoint — this site stores nothing. The hidden "name"
	// field and the submit-time floor are the bot checks that endpoint expects.
	const ENDPOINT = "https://hyperplexed.io/api/sub";

	let email = $state("");
	let honeypot = $state("");
	let status = $state<"idle" | "sending" | "done" | "error">("idle");

	const loadedAt = Date.now();

	const subscribe = async (event: SubmitEvent) => {
		event.preventDefault();

		if (status === "sending" || honeypot || Date.now() - loadedAt < 1000) return;

		status = "sending";

		try {
			const response = await fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, source: "contest", name: honeypot, timestamp: loadedAt })
			});

			if (!response.ok) throw new Error(`subscribe failed: ${response.status}`);

			status = "done";
			email = "";
		} catch {
			status = "error";
		}
	};
</script>

<div class="rounded-card border border-line bg-card p-6 shadow-card">
	<h2 class="m-0 mb-1 text-lg font-semibold">Get contest updates</h2>
	<p class="m-0 mb-4 text-sm leading-relaxed text-mut">
		New contests, entry deadlines, and results reveals — nothing else.
	</p>

	{#if status === "done"}
		<p class="m-0 text-sm font-medium text-acc">Subscribed — check your inbox.</p>
	{:else}
		<form class="flex flex-wrap gap-2.5" onsubmit={subscribe}>
			<input
				type="text"
				name="name"
				bind:value={honeypot}
				tabindex="-1"
				autocomplete="off"
				aria-hidden="true"
				class="pointer-events-none absolute top-0 left-0 -z-50 h-0 w-0 opacity-0"
			/>

			<input
				type="email"
				required
				placeholder="you@example.com"
				bind:value={email}
				disabled={status === "sending"}
				class="min-w-0 flex-1 rounded-control border border-line bg-bg2 px-3.5 py-2 text-sm text-tx placeholder:text-dim focus:border-line2 focus:outline-none"
			/>

			<button
				type="submit"
				disabled={status === "sending"}
				class="rounded-control border border-line bg-card px-3.5 py-2 text-sm font-medium text-acc hover:border-line2 disabled:opacity-60"
			>
				{status === "sending" ? "Subscribing…" : "Subscribe"}
			</button>
		</form>

		{#if status === "error"}
			<p class="m-0 mt-2 text-sm text-mut">Something went wrong — try again in a minute.</p>
		{/if}

		<p class="m-0 mt-3 text-xs leading-relaxed text-dim">
			Your email goes to the hyperplexed.io mailing list (sent via Resend) and is only used for
			contest updates. Every email includes a one-click unsubscribe.
		</p>
	{/if}
</div>
