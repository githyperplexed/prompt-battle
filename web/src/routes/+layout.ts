// Fully static: every route is prerendered at build time and ships no client-side JavaScript.
// The one interactive piece (the subscribe form) is a small plain script in /static.
export const prerender = true;
export const csr = false;
