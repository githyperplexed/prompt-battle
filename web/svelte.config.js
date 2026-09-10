import adapter from "@sveltejs/adapter-static";

import { SITE_URL } from "./src/lib/contest.js";

/** @type {import("@sveltejs/kit").Config} */
const config = {
	kit: {
		adapter: adapter({ pages: "build", assets: "build", strict: true }),
		// Every page is prerendered, so canonical/OG URLs need the real origin at build time.
		prerender: { origin: SITE_URL }
	}
};

export default config;
