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
  - `web` — SvelteKit UI.
  - `worker` and `web` both depend on `db`. `db` depends on neither.

## Formatting (automated — don't hand-format)

Prettier owns whitespace and code style. Run `bun run format`, or rely on format-on-save.
Settings live in `.prettierrc.json`: **tabs, double quotes, no trailing commas, 100-char
print width.** Don't fight it by hand.

## Manual conventions (Prettier can't enforce these)

- **Tailwind classes:** always compose with the `cn()` helper (clsx + tailwind-merge).
  Never raw string concatenation or bare template literals for class lists.
- **Imports:** group logically — built-ins, then third-party, then internal (`@prompt-battle/db`
  and aliases), then relative. Ordering is intentionally **not** auto-enforced; keep it
  sensible by hand.
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
  PostCSS); TypeScript strict; Drizzle ORM + PostgreSQL; Vitest for tests; `adapter-node`
  for deploy (kept in `devDependencies` — it's a build-time tool).
- `vitePreprocess()` is not needed with `@sveltejs/vite-plugin-svelte` v6+.
- Verify packages and patterns are current best practice before adding them.

## Commits

- One logical change per commit; keep the diff focused.
- Subject: imperative mood, present tense, concise (≤ ~70 chars), no trailing period —
  e.g. `add db package skeleton`.
- Body (optional): explain the _why_, not just the _what_. Wrap at ~100 chars.
