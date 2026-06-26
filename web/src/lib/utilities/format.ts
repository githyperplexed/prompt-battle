export const formatUtc = (iso: string | null): string => {
	if (!iso) return "—";

	const date = new Date(iso);
	const day = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC"
	});
	const time = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "UTC"
	});

	return `${day} · ${time} UTC`;
};
