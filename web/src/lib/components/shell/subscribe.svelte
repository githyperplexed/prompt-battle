<svelte:head>
	<script src="/subscribe.js" defer></script>
</svelte:head>

<section class="border-b border-line py-12">
	<p class="m-0 font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Updates</p>
	<h2 class="mt-3 mb-2 text-2xl font-semibold tracking-tight">Hear about the next one</h2>
	<p class="m-0 mb-6 max-w-xl text-sm leading-relaxed text-mut">
		New contests, entry deadlines, and results reveals. Nothing else.
	</p>

	<p data-subscribe-done hidden class="m-0 text-sm">
		Email sent. Check your inbox for the confirmation link.
	</p>

	<form data-subscribe class="flex max-w-xl flex-wrap gap-2">
		<input
			type="text"
			name="name"
			tabindex="-1"
			autocomplete="off"
			aria-hidden="true"
			class="pointer-events-none absolute top-0 left-0 -z-50 h-0 w-0 opacity-0"
		/>

		<input
			type="email"
			name="email"
			required
			placeholder="you@example.com"
			class="min-w-0 flex-1 border border-line bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-dim focus:border-fg focus:outline-none"
		/>

		<button
			type="submit"
			class="border border-fg bg-fg px-5 py-2.5 text-sm font-medium text-bg hover:bg-bg hover:text-fg disabled:opacity-60"
		>
			Subscribe
		</button>
	</form>

	<p data-subscribe-error hidden class="m-0 mt-3 text-sm text-mut">
		Something went wrong. Try again in a minute.
	</p>

	<p class="m-0 mt-4 max-w-xl text-xs leading-relaxed text-dim">
		Your email goes to the hyperplexed.io mailing list (sent via Resend) and is only used for
		contest updates. Every email includes a one-click unsubscribe.
	</p>
</section>
