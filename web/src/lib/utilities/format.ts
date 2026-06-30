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
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: "UTC"
	});

	return `${day} · ${time} UTC`;
};

// The viewer's local time. Only safe to render after mount (the server has no timezone), so pair it
// with the LocalTime component, which falls back to formatUtc during SSR/hydration.
export const formatLocal = (iso: string | null): string => {
	if (!iso) return "–";

	const date = new Date(iso);
	const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

	return `${day} · ${time}`;
};
