import adapter from "@sveltejs/adapter-node";

// No preprocessor: @sveltejs/vite-plugin-svelte v6+ handles <script lang="ts"> natively,
// so vitePreprocess() is not needed.
/** @type {import("@sveltejs/kit").Config} */
const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
