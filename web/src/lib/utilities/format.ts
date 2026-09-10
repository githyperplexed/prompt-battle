export const formatUtc = (iso: string | null): string => {
	if (!iso) return "–";

	const date = new Date(iso);
	const day = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC"
	});
	const time = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: "UTC"
	});

	return `${day} · ${time} UTC`;
};

export const formatDate = (iso: string | null): string => {
	if (!iso) return "–";

	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC"
	});
};

export const formatScore = (score: number): string => score.toFixed(1);

export const formatBytes = (bytes: number): string => `${(bytes / 1_000_000).toFixed(1)} MB`;
