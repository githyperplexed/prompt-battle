export type DqCount = { reason: string; count: number };

export type StatusReport = {
	id: string;
	videoId: string;
	status: string;
	createdAt: string;
	snapshotAt: string;
	capturedAt: string | null;
	resultsPublishedAt: string | null;
	snapshotDue: boolean | null;
	panel: string[];
	scorePromptHash: string;
	comparePromptHash: string;
	keywordHash: string;
	field: { total: number; eligible: number; disqualified: number; dq: DqCount[] } | null;
	scoring: {
		done: number;
		expected: number;
		perModel: { id: string; done: number }[];
		complete: boolean;
	} | null;
	bracket: {
		matchups: number;
		expected: number;
		winner: { author: string; score: number; seed: number | null } | null;
		fingerprint: string | null;
		published: boolean;
	} | null;
};

export type ContestSummary = { id: string; videoId: string; status: string; hasWinner: boolean };

const shortHash = (hash: string): string => (hash && hash !== "—" ? `${hash.slice(0, 10)}…` : "—");

// The command an operator should run next from each status.
export const nextStep = (status: string, published: boolean): string => {
	switch (status) {
		case "draft":
		case "open":
			return "ingest --contest <id>  (at or after the snapshot cutoff)";
		case "snapshotted":
			return "score --contest <id>";
		case "scoring":
			return "score --contest <id>  (resume — scoring incomplete)";
		case "scored":
			return "advance --contest <id>";
		case "complete":
			return published
				? "results published — pipeline complete"
				: "publish --contest <id>  (when the reveal goes live)";
		default:
			return "—";
	}
};

export const formatStatusReport = (report: StatusReport): string[] => {
	const lines: string[] = [];
	const row = (key: string, value: string) => lines.push(`  ${key.padEnd(14)}${value}`);

	lines.push(`Contest ${report.id}`);
	row("video:", report.videoId);
	row("status:", report.status);
	row("created:", report.createdAt);

	const dueNote =
		report.snapshotDue === true ? "  (due)" : report.snapshotDue === false ? "  (not yet due)" : "";
	row("snapshot at:", report.snapshotAt + dueNote);
	row("captured:", report.capturedAt ?? "—");
	row("published:", report.resultsPublishedAt ?? "—");

	lines.push("");
	lines.push("Config (pinned)");
	row("panel:", report.panel.join(", ") || "—");
	row("score prompt:", shortHash(report.scorePromptHash));
	row("compare:", shortHash(report.comparePromptHash));
	row("keywords:", shortHash(report.keywordHash));

	if (report.field) {
		lines.push("");
		lines.push("Field");
		row("total:", String(report.field.total));
		row("eligible:", String(report.field.eligible));
		row("disqualified:", String(report.field.disqualified));
		for (const d of report.field.dq) lines.push(`      ${d.reason.padEnd(20)} ${d.count}`);
	}

	if (report.scoring) {
		lines.push("");
		lines.push("Scoring");
		row(
			"scores:",
			`${report.scoring.done} / ${report.scoring.expected}${report.scoring.complete ? "  (complete)" : ""}`
		);
		row("per model:", report.scoring.perModel.map((m) => `${m.id} ${m.done}`).join(" · ") || "—");
	}

	if (report.bracket) {
		lines.push("");
		lines.push("Bracket");
		row("matchups:", `${report.bracket.matchups} / ${report.bracket.expected}`);

		if (report.bracket.winner) {
			const w = report.bracket.winner;
			row("winner:", `${w.author} (score ${w.score.toFixed(1)}, seed #${w.seed ?? "—"})`);
		}

		row("fingerprint:", shortHash(report.bracket.fingerprint ?? "—"));
		row("published:", report.bracket.published ? "yes" : "no (embargoed)");
	}

	lines.push("");
	const next = nextStep(report.status, !!report.resultsPublishedAt).replace(/<id>/g, report.id);
	lines.push(`Next → ${next}`);

	return lines;
};

export const formatContestList = (rows: ContestSummary[]): string[] => {
	if (rows.length === 0) return ["No contests found."];

	return [
		`${rows.length} contest(s):`,
		...rows.map(
			(r) => `  ${r.id}  ${r.status.padEnd(12)} ${r.videoId}${r.hasWinner ? "  ✓ winner" : ""}`
		)
	];
};
