import { makeNonce, replaceTokens } from "$src/utilities/text";

export type PromptSections = { system: string; user: string };

export const buildScoreMessages = (
	template: PromptSections,
	entryText: string
): PromptSections & { nonce: string } => {
	const nonce = makeNonce();
	const user = replaceTokens(template.user.split("{{NONCE}}").join(nonce), {
		"{{ENTRY_TEXT}}": entryText
	});

	return { system: template.system, user, nonce };
};

export const buildCompareMessages = (
	template: PromptSections,
	entryA: string,
	entryB: string
): PromptSections => {
	const nonceA = makeNonce();
	let nonceB = makeNonce();

	while (nonceB === nonceA) nonceB = makeNonce(); // the two markers must differ

	const templated = template.user
		.split("{{NONCE_A}}")
		.join(nonceA)
		.split("{{NONCE_B}}")
		.join(nonceB);
	// Insert both entries together so neither replacement can activate tokens inside the other.
	const user = replaceTokens(templated, { "{{ENTRY_A}}": entryA, "{{ENTRY_B}}": entryB });

	return { system: template.system, user };
};
