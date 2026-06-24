import { describe, expect, test } from "bun:test";

import { buildCompareMessages, buildScoreMessages } from "../src/utilities/prompts";

describe("prompt message builders", () => {
	test("uses the supplied score template without rescanning entry text", () => {
		const template = {
			system: "pinned score system",
			user: "{{NONCE}}\n{{ENTRY_TEXT}}\n{{NONCE}}"
		};
		const result = buildScoreMessages(template, "entry with literal {{NONCE}}");

		expect(result.system).toBe(template.system);
		expect(result.user).toContain("entry with literal {{NONCE}}");
		expect(result.user.split(result.nonce)).toHaveLength(3);
	});

	test("inserts both comparison entries in one pass", () => {
		const template = {
			system: "pinned compare system",
			user: "{{NONCE_A}}\n{{ENTRY_A}}\n{{NONCE_A}}\n{{NONCE_B}}\n{{ENTRY_B}}\n{{NONCE_B}}"
		};
		const result = buildCompareMessages(
			template,
			"entry A with literal {{ENTRY_B}}",
			"entry B with literal {{ENTRY_A}}"
		);

		expect(result.system).toBe(template.system);
		expect(result.user).toContain("entry A with literal {{ENTRY_B}}");
		expect(result.user).toContain("entry B with literal {{ENTRY_A}}");
	});
});
