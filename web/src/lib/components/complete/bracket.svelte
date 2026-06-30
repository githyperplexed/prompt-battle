<script lang="ts">
	import BracketNode from "$lib/components/complete/bracket-node.svelte";
	import MatchupDetail from "$lib/components/complete/matchup-detail.svelte";
	import { cn } from "$lib/utilities/cn";
	import type { BracketRound } from "$lib/types/contest";

	let { rounds, contestId }: { rounds: BracketRound[]; contestId: string } = $props();

	const navLabels = ["R64", "R32", "R16", "QF", "SF", "F"];

	let selectedId = $state<string | null>(null);
	let mobileRound = $state<number | null>(null);

	const activeId = $derived(selectedId ?? rounds.at(-1)?.matchups[0]?.id ?? null);
	const activeRound = $derived(mobileRound ?? rounds.at(-1)?.round ?? 1);
	const mobileMatchups = $derived(rounds.find((r) => r.round === activeRound)?.matchups ?? []);

	let treeEl = $state<HTMLElement | null>(null);
	let svgW = $state(0);
	let svgH = $state(0);
	let pathD = $state("");

	// Measure each node and draw orthogonal elbow connectors from each pair to their parent.
	const draw = () => {
		const tree = treeEl;
		if (!tree) return;

		const box = tree.getBoundingClientRect();
		svgW = tree.scrollWidth;
		svgH = tree.scrollHeight;

		const pos = (id: string) => {
			const el = tree.querySelector(`[data-mid="${id}"]`);
			if (!el) return null;

			const r = el.getBoundingClientRect();

			return {
				left: r.left - box.left,
				right: r.right - box.left,
				y: (r.top + r.bottom) / 2 - box.top
			};
		};

		let d = "";

		for (let ri = 1; ri < rounds.length; ri += 1) {
			const round = rounds[ri]!.matchups;
			const child = rounds[ri - 1]!.matchups;

			for (let k = 0; k < round.length; k += 1) {
				const childA = child[2 * k];
				const childB = child[2 * k + 1];
				if (!childA || !childB) continue;

				const p = pos(round[k]!.id);
				const a = pos(childA.id);
				const b = pos(childB.id);
				if (!p || !a || !b) continue;

				const midX = (a.right + p.left) / 2;
				d += `M${a.right} ${a.y}H${midX}V${p.y}H${p.left}M${b.right} ${b.y}H${midX}V${p.y}`;
			}
		}

		pathD = d;
	};

	$effect(() => {
		void rounds;
		const run = () => requestAnimationFrame(draw);

		run();
		window.addEventListener("resize", run);

		return () => window.removeEventListener("resize", run);
	});
</script>

<h3 class="m-0 text-lg font-semibold">
	The bracket <span class="text-sm text-dim">· 64 → 1 · 6 rounds · 63 matchups</span>
</h3>

<!-- Mobile: round selector + a single round's matchups as a list. -->
<div class="hidden flex-wrap gap-1.5 max-md:flex">
	{#each rounds as round (round.round)}
		<button
			type="button"
			class={cn(
				"rounded-control border px-3 py-1.5 font-mono text-xs",
				activeRound === round.round
					? "border-acc bg-acc font-semibold text-ink"
					: "border-line bg-card text-mut"
			)}
			onclick={() => (mobileRound = round.round)}
		>
			{navLabels[round.round - 1] ?? `R${round.round}`}
		</button>
	{/each}
</div>

<div class="hidden flex-col gap-2.5 rounded-card border border-line bg-card p-4 max-md:flex">
	<div class="text-center font-mono text-xs tracking-widest text-dim uppercase">
		{rounds.find((r) => r.round === activeRound)?.label}
	</div>
	{#each mobileMatchups as matchup (matchup.id)}
		<BracketNode
			{matchup}
			selected={selectedId === matchup.id}
			onSelect={() => (selectedId = matchup.id)}
		/>
	{/each}
</div>

<!-- Desktop: horizontally-scrollable column tree with SVG elbow connectors. -->
<div class="overflow-x-auto rounded-card border border-line bg-card max-md:hidden">
	<div bind:this={treeEl} class="relative flex min-w-max gap-5 p-5">
		<svg
			class="pointer-events-none absolute inset-0 z-0 overflow-visible"
			width={svgW}
			height={svgH}
			viewBox={`0 0 ${svgW} ${svgH}`}
		>
			<path d={pathD} fill="none" stroke="var(--color-line2)" stroke-width="1.5" />
		</svg>

		{#each rounds as round (round.round)}
			<div class="relative z-1 flex min-w-[172px] flex-col justify-around gap-3">
				<div class="mb-1 text-center font-mono text-xs tracking-widest text-dim uppercase">
					{round.label}
				</div>
				{#each round.matchups as matchup (matchup.id)}
					<BracketNode
						{matchup}
						selected={activeId === matchup.id}
						onSelect={() => (selectedId = matchup.id)}
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>

<MatchupDetail {contestId} matchupId={activeId} />
