import { describe, expect, test } from "bun:test";

import { classifyComment, containsUrl, countCharacters } from "../src/utilities/validation";

describe("URL detection", () => {
	test("flags protocol and www links", () => {
		expect(containsUrl("check https://example.com/page")).toBe(true);
		expect(containsUrl("check http://example.com")).toBe(true);
		expect(containsUrl("check www.example.com out")).toBe(true);
	});

	test("flags youtu.be share links", () => {
		expect(containsUrl("watch youtu.be/dQw4w9WgXcQ instead")).toBe(true);
	});

	test("flags bare domains on common TLDs", () => {
		expect(containsUrl("go to example.com now")).toBe(true);
		expect(containsUrl("my channel is example.tv")).toBe(true);
		expect(containsUrl("built with example.ai tools")).toBe(true);
	});

	test("does not flag hyphenated prose after a missing space", () => {
		expect(containsUrl("that ending was epic.Co-sign everything said here")).toBe(false);
	});

	test("does not flag ordinary sentences", () => {
		expect(containsUrl("I used to be a big fan. Come on, pick me!")).toBe(false);
		expect(containsUrl("the barbecue looked great")).toBe(false);
	});
});

describe("comment classification", () => {
	const keywords = ["alpha", "beta"];
	const context = { keywords, excluded: new Set<string>() };
	const validText = "alpha beta this entry is long enough to satisfy minimum length";

	test("accepts a valid comment", () => {
		expect(classifyComment({ text: validText, channelId: "channel-1" }, context)).toEqual({
			eligible: true
		});
	});

	test("counts length bounds inclusively on code points", () => {
		const fifty = "alpha beta " + "🎉".repeat(39);

		expect(countCharacters(fifty)).toBe(50);
		expect(classifyComment({ text: fifty, channelId: "channel-1" }, context)).toEqual({
			eligible: true
		});

		const tooShort = fifty.slice(0, -2);

		expect(classifyComment({ text: tooShort, channelId: "channel-1" }, context)).toEqual({
			eligible: false,
			reason: "too_short"
		});
	});

	test("rejects over-length comments", () => {
		const tooLong = "alpha beta " + "x".repeat(995);

		expect(classifyComment({ text: tooLong, channelId: "channel-1" }, context)).toEqual({
			eligible: false,
			reason: "too_long"
		});
	});

	test("checks affiliation before anything else", () => {
		expect(
			classifyComment(
				{ text: validText, channelId: "owner" },
				{ keywords, excluded: new Set(["owner"]) }
			)
		).toEqual({ eligible: false, reason: "affiliated" });
	});

	test("rejects missing keywords and URLs", () => {
		expect(
			classifyComment(
				{ text: "beta only, but padded out to satisfy the minimum length rule", channelId: "c" },
				context
			)
		).toEqual({ eligible: false, reason: "missing_keywords" });
		expect(
			classifyComment({ text: validText + " see youtu.be/abc123xyz", channelId: "c" }, context)
		).toEqual({ eligible: false, reason: "has_url" });
	});
});
