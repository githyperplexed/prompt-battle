<script lang="ts">
	import BracketNode from "$lib/components/complete/bracket-node.svelte";
	import MatchupDetail from "$lib/components/complete/matchup-detail.svelte";
	import { cn } from "$lib/utilities/cn";
	import type {
		BracketMatchup,
		BracketRound,
		MatchupDetail as MatchupDetailData
	} from "$lib/types/contest";

	let { rounds, details }: { rounds: BracketRound[]; details: Record<string, MatchupDetailData> } =
		$props();

	const navLabels = ["R64", "R32", "R16", "QF", "SF", "F"];

	let selectedId = $state<string | null>(null);
	let mobileRound = $state<number | null>(null);

	const activeId = $derived(selectedId ?? rounds.at(-1)?.matchups[0]?.id ?? null);
	const activeDetail = $derived(activeId ? (details[activeId] ?? null) : null);
	const activeRound = $derived(mobileRound ?? rounds.at(-1)?.round ?? 1);
	const mobileMatchups = $derived(rounds.find((r) => r.round === activeRound)?.matchups ?? []);

	type Column = { key: string; label: string; matchups: BracketMatchup[] };

	// Two-sided layout: every round (except the final) is split in half — the first half
	// flows inward from the left edge, the second half inward from the right edge — and the
	// single final matchup sits in the center where the two sides meet.
	const columns = $derived.by<Column[]>(() => {
		if (rounds.length === 0) return [];

		const last = rounds.length - 1;
		const left: Column[] = [];
		const right: Column[] = [];

		for (let r = 0; r < last; r += 1) {
			const ms = rounds[r]!.matchups;
			const half = Math.ceil(ms.length / 2);
			left.push({ key: `l${r}`, label: rounds[r]!.label, matchups: ms.slice(0, half) });
			right.push({ key: `r${r}`, label: rounds[r]!.label, matchups: ms.slice(half) });
		}

		const center: Column = { key: "c", label: rounds[last]!.label, matchups: rounds[last]!.matchups };

		return [...left, center, ...right.reverse()];
	});

	const maxColCount = $derived(Math.max(1, ...columns.map((c) => c.matchups.length)));

	// Every column shares one node-area height so `justify-around` spaces the nodes such that
	// each parent lands exactly between its two children. The label lives outside that area so
	// it never offsets the distribution.
	const GAP = 16;
	let nodeH = $state(72);
	const areaH = $derived(maxColCount * (nodeH + GAP));

	let treeEl = $state<HTMLElement | null>(null);
	let svgW = $state(0);
	let svgH = $state(0);
	let pathD = $state("");

	// Measure node positions and draw orthogonal elbow connectors from each child to its parent.
	// The elbow direction follows the child's position relative to the parent, so it works for the
	// left side, the right (mirrored) side, and the final that joins both.
	const draw = () => {
		const tree = treeEl;
		if (!tree) return;

		const sample = tree.querySelector<HTMLElement>("[data-mid]");
		if (sample) {
			const h = sample.getBoundingClientRect().height;
			if (h && Math.abs(h - nodeH) > 0.5) nodeH = h;
		}

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
				const p = pos(round[k]!.id);
				if (!p) continue;

				for (const ci of [2 * k, 2 * k + 1]) {
					const c = child[ci];
					if (!c) continue;

					const cp = pos(c.id);
					if (!cp) continue;

					if (cp.right <= p.left) {
						// child sits to the left of its parent
						const midX = (cp.right + p.left) / 2;
						d += `M${cp.right} ${cp.y}H${midX}V${p.y}H${p.left}`;
					} else {
						// child sits to the right of its parent (mirrored side)
						const midX = (p.right + cp.left) / 2;
						d += `M${cp.left} ${cp.y}H${midX}V${p.y}H${p.right}`;
					}
				}
			}
		}

		pathD = d;
	};

	$effect(() => {
		void columns;
		void areaH;

		const run = () => requestAnimationFrame(draw);

		run();
		window.addEventListener("resize", run);

		return () => window.removeEventListener("resize", run);
	});

	// Click-and-drag panning of the (scrollbar-less) bracket viewport. The pointer is only
	// captured once a real drag begins — otherwise capture would retarget the trailing click to
	// the scroller and a plain click could never reach a matchup node.
	let scroller = $state<HTMLElement | null>(null);
	let dragging = $state(false);
	let pressing = false;
	let moved = false;
	let startX = 0;
	let startY = 0;
	let startLeft = 0;
	let startTop = 0;

	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0 || !scroller) return;

		pressing = true;
		moved = false;
		startX = e.clientX;
		startY = e.clientY;
		startLeft = scroller.scrollLeft;
		startTop = scroller.scrollTop;
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!pressing || !scroller) return;

		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!moved && Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;

		if (!moved) {
			moved = true;
			dragging = true;
			scroller.setPointerCapture(e.pointerId);
		}

		scroller.scrollLeft = startLeft - dx;
		scroller.scrollTop = startTop - dy;
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!pressing) return;

		pressing = false;
		dragging = false;
		if (scroller?.hasPointerCapture(e.pointerId)) scroller.releasePointerCapture(e.pointerId);
	};

	// Swallow the click that ends a drag so panning never selects a matchup.
	const onClickCapture = (e: MouseEvent) => {
		if (!moved) return;

		e.stopPropagation();
		e.preventDefault();
		moved = false;
	};
</script>

<h3 class="m-0 text-lg font-semibold">
	The bracket <span class="text-sm text-dim">· Top 64</span>
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

<!-- Desktop: two-sided tree with SVG elbow connectors. Drag anywhere to pan; no scrollbar. -->
<div
	bind:this={scroller}
	class={cn(
		"bracket-viewport h-160 touch-none overflow-auto overscroll-contain rounded-card border border-line bg-card select-none max-md:hidden",
		dragging ? "cursor-grabbing" : "cursor-grab"
	)}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onclickcapture={onClickCapture}
	role="group"
	aria-label="Tournament bracket, drag to pan"
>
	<div class="min-w-max">
		<!-- Round labels: pinned to the top of the viewport (sticky) but scrolling horizontally with
		     the columns, so each label always sits above its round wherever the bracket is panned. -->
		<div class="sticky top-0 z-10 flex gap-5 border-b border-line bg-card px-5 pt-5 pb-2">
			{#each columns as column (column.key)}
				<div class="w-43 text-center font-mono text-xs tracking-widest text-dim uppercase">
					{column.label}
				</div>
			{/each}
		</div>

		<div bind:this={treeEl} class="relative flex gap-5 px-5 pt-3 pb-5">
			<svg
				class="pointer-events-none absolute inset-0 z-0 overflow-visible"
				width={svgW}
				height={svgH}
				viewBox={`0 0 ${svgW} ${svgH}`}
			>
				<path d={pathD} fill="none" stroke="var(--color-line2)" stroke-width="1.5" />
			</svg>

			{#each columns as column (column.key)}
				<div class="relative z-1 flex w-43 flex-col justify-around" style={`height:${areaH}px`}>
					{#each column.matchups as matchup (matchup.id)}
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
</div>

<MatchupDetail detail={activeDetail} />

<style>
	.bracket-viewport {
		scrollbar-width: none;
	}

	.bracket-viewport::-webkit-scrollbar {
		display: none;
	}
</style>
