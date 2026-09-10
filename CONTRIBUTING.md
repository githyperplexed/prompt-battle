# Contributing

Conventions for working in this repo. Formatting is automated by Prettier — this file
covers the **manual** standards Prettier can't enforce, plus tooling and commit
guidelines. Any contributor, human or LLM, should follow these.

## Tooling

- **Bun only.** Use `bun` / `bunx` for everything — installing, running, scripts. Never
  npm, npx, yarn, or pnpm.
- **Monorepo (Bun workspaces).** Three top-level packages:
  - `db` — shared Drizzle schema + Postgres client.
  - `worker` — Bun CLI (ingest / score / advance).
  - `web` — static SvelteKit results site, prerendered from the exported audit bundle.
  - `worker` depends on `db`. `web` and `db` depend on nothing in the workspace.

## Formatting (automated — don't hand-format)

Prettier owns whitespace and code style. Run `bun run format`, or rely on format-on-save.
Settings live in `.prettierrc.json`: **tabs, double quotes, no trailing commas, 100-char
print width.** Don't fight it by hand.

## Manual conventions (Prettier can't enforce these)

- **`services/` vs `utilities/`.** In each package, pure logic — deterministic, no I/O
  (transforms, validation, parsing, hashing, building request payloads) — goes in
  `utilities/`. Anything that performs or orchestrates I/O — database, network/API,
  filesystem, env — goes in `services/`. Services may call utilities; utilities never import
  services. CLI / command files stay thin and delegate to services. Similarity clustering follows this split: embedding/database orchestration stays in `services/`, while normalization, shingling, cosine/Jaccard math, fingerprinting, and clustering stay in `utilities/`.
- **Tailwind classes:** always compose with the `cn()` helper (clsx + tailwind-merge).
  Never raw string concatenation or bare template literals for class lists.
- **Imports:** group logically — built-ins, then third-party, then internal (`@prompt-battle/db`
  and `$src/*`), then any relative. Ordering is intentionally **not** auto-enforced; keep it
  sensible by hand. The `worker` package uses a `$src/*` alias (→ `worker/src/*`) for its
  in-package imports; `db` stays on relative imports, since path aliases don't resolve across
  package boundaries when one package imports another's source.
- **Functions:** prefer `const` arrow functions (`const foo = () => …`) over `function`
  declarations. Use an implicit return for single-expression functions.
- **Breathing room (line breaks):** Prettier won't add blank lines for you. Group related
  `const` / `let` declarations, but put a blank line **before a control-flow statement**
  (`if`, `for`, `while`, `switch`) that follows such a group, and a blank line **before a
  `return`** (unless it is the only statement in the block).
- **No unnecessary comments.** Don't restate what the code or a name already makes clear.
  Comment only to explain non-obvious **why** — a gotcha, a rationale, or domain meaning.
- **Naming:** kebab-case for files and directories; PascalCase for Svelte components;
  camelCase for variables and functions.
- **Secrets never get committed.** Keywords, seeds, and keys live in `.env` / ignored
  files. Only their committed hashes go public (see `rules.md`).

## Stack conventions

- SvelteKit 5 (runes mode); Tailwind CSS v4 via the `@tailwindcss/vite` plugin (not
  PostCSS); TypeScript strict; Drizzle ORM + PostgreSQL (worker only); Vitest for tests;
  `adapter-static` with every route prerendered and `csr = false`, deployed as Cloudflare
  Workers static assets via `wrangler` (both kept in `devDependencies` — build-time tools).
- The site reads the audit bundle at build time only (`web/src/lib/server/results.ts`); page
  data never reaches a browser as JSON, so keep the site free of client-side state. The one
  script is `web/static/subscribe.js`.
- `vitePreprocess()` is not needed with `@sveltejs/vite-plugin-svelte` v6+.
- Verify packages and patterns are current best practice before adding them.

## Commits

**Never commit, push, create a pull request, or otherwise publish changes unless the user
explicitly requests that action.** Approval to implement or edit files is not approval to
commit or publish them.

- One logical change per commit; keep the diff focused.
- Subject: imperative mood, present tense, concise (≤ ~70 chars), no trailing period —
  e.g. `add db package skeleton`.
- Body (optional): explain the _why_, not just the _what_. Wrap at ~100 chars.
