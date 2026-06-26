export const judgeLabel = (index: number): string =>
	["Judge A", "Judge B", "Judge C"][index] ?? `Judge ${index + 1}`;

// Full Tailwind class strings (kept literal so the scanner emits the j1/j2/j3 colors), indexed
// by panel position so a per-model breakdown stays color-consistent across the UI.
export const JUDGE_TEXT = ["text-j1", "text-j2", "text-j3"];
export const JUDGE_BG = ["bg-j1", "bg-j2", "bg-j3"];
export const JUDGE_BORDER = ["border-j1", "border-j2", "border-j3"];

export const judgeText = (index: number): string => JUDGE_TEXT[index] ?? JUDGE_TEXT[0]!;
export const judgeBg = (index: number): string => JUDGE_BG[index] ?? JUDGE_BG[0]!;
export const judgeBorder = (index: number): string => JUDGE_BORDER[index] ?? JUDGE_BORDER[0]!;
