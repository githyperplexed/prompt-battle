// Greedy order-preserving packer: each batch stays under both caps unless a single item
// alone exceeds the char cap, in which case it gets its own batch (an item cannot be split).
export const packBatches = (texts: string[], maxChars: number, maxCount: number): string[][] => {
	const batches: string[][] = [];
	let current: string[] = [];
	let chars = 0;

	for (const text of texts) {
		const overflows = chars + text.length > maxChars || current.length >= maxCount;

		if (current.length > 0 && overflows) {
			batches.push(current);
			current = [];
			chars = 0;
		}

		current.push(text);
		chars += text.length;
	}

	if (current.length > 0) batches.push(current);

	return batches;
};
