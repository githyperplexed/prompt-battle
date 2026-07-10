# Repository instructions

- Never commit, push, create a pull request, or otherwise publish changes unless the user
  explicitly requests that action. Approval to implement or edit files is not approval to
  commit or publish them.
- Never run `db:generate` / `db:migrate` / `db:push` — the maintainer runs all migrations.
- Only leave comments in code if absolutely essential — to explain a non-obvious _why_ (a
  gotcha, rationale, or domain meaning). Never restate what the code or a name already makes
  clear.
- Bun only (`bun` / `bunx`) — never npm, npx, yarn, or pnpm.

## What this repo is

An open-source YouTube comment contest engine ("prompt battle"): viewers comment on a video
trying to convince an AI panel their comment should win; the engine snapshots the comments at
a cutoff, scores them with a pinned three-model panel, applies a near-duplicate originality
pass, and runs a seeded single-elimination bracket to one winner. Everything that decides the
outcome is hash-committed before judging so the result is independently auditable.

Three Bun workspace packages: `db` (Drizzle schema + Postgres client), `worker` (the CLI that
runs a contest: create → ingest → dq → score → cluster → advance → publish → export, plus
reset / delete / status / smoke / verify), and `web` (SvelteKit site that renders contest
state read-only).
`worker` and `web` both depend on `db`; `db` depends on neither.

## Essential documents — the map

Read these in this order when orienting; each has one job:

| File                               | What it is                                                                                                                                                                         | How to use it                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [rules.md](rules.md)               | The **public rules of the game** — the contract the engine implements (eligibility, snapshot semantics, rubric, scoring math, bracket, tie-breaks, auditability promises).         | Treat as the spec. Any change to game logic must match it (and vice versa — update it in the same change). Never changed during a live contest; `TBD` items are decided per contest.                                                                                                                                                                           |
| [RUNBOOK.md](RUNBOOK.md)           | The **operator manual** — prerequisites, env vars, the exact command sequence for one contest, recovery procedures (fingerprint mismatch, resets), and what each command may cost. | Follow it to run or reason about contest operations. First command in any unknown state: `bun run worker status`. Keep it in sync when CLI behavior changes.                                                                                                                                                                                                   |
| [verification.md](verification.md) | The **audit guide** — what is hash-committed and when, the exact hash/fingerprint formulas, and the six checks that prove a published result follows from the frozen inputs.       | Use to understand the trust model before touching hashing, scoring, ranking, similarity, or bracket code — those formulas are public commitments; changing them mid-contest breaks verifiability. Update it when they legitimately change.                                                                                                                     |
| [CONTRIBUTING.md](CONTRIBUTING.md) | The **code conventions** — tooling, formatting (Prettier owns style), `services/` (I/O) vs `utilities/` (pure) split, naming, import grouping, comment policy, commit rules.       | Follow for every edit. The pure/IO split is load-bearing: it is what keeps game logic unit-testable without a database.                                                                                                                                                                                                                                        |
| [CHANGELOG.md](CHANGELOG.md)       | The **narrative build log** — phases in build order with the key decisions and findings at each step (not a release changelog).                                                    | Read to learn why things are the way they are. When landing a major change or design decision, write it up as the `## Current — …` section at the top and roll the previous Current down to the next phase number.                                                                                                                                             |
| [config.json](config.json)         | The **default judge panel** (3 models, 3 distinct providers).                                                                                                                      | Copied into a contest's config at `create` and frozen there — editing this file never affects an existing contest.                                                                                                                                                                                                                                             |
| [prompts/](prompts/)               | The **judge prompt templates** (`judge-score.md`, `judge-compare.md`).                                                                                                             | ⚠ The loader strips HTML comments and splits on `## System message` / `## User message` — content inside the `<!-- … -->` header is documentation and is NEVER sent to a model. Live prompt text goes below the comment, in the marker sections. Hashes of the (normalized) sections are pinned per contest; `worker/test/prompts.test.ts` guards the loading. |
| [secrets/](secrets/)               | **Gitignored keyword secrets**, one `secrets/<videoId>.json` per contest (format in `example.json`): the hidden keywords + salt. Generate with `bun run worker secret`.            | Required locally by `create`, `ingest`, `cluster`, and `publish`. Only the salted hash is ever committed or stored; never commit the plaintext.                                                                                                                                                                                                                |
| [db/drizzle/](db/drizzle/)         | Generated SQL **migrations** + snapshots.                                                                                                                                          | Generated from `db/src/schema/*.ts` by the maintainer (`db:generate`), applied by the maintainer (`db:migrate`). Schema edits are fine; running the tools is not.                                                                                                                                                                                              |

Mental model of how they relate: **rules.md is the promise, the worker is the
implementation, RUNBOOK.md operates it, verification.md proves it, CHANGELOG.md remembers
why, CONTRIBUTING.md governs how the code is written.** A change that touches game behavior
usually needs the code, its tests, rules.md, RUNBOOK.md, and (if it alters a commitment or
formula) verification.md — in the same change.

## Operating pointers

- **Orient:** `bun run worker status` (needs only `DATABASE_URL`) — phase, counts, pinned
  hashes, and the next command. `--json` includes the same plus a `next` field.
- **Verify changes:** `bun test` from `worker/` (unit tests for all pure logic),
  `bun run check` in `worker/` (tsc) and in `web/` (svelte-check),
  `bun run format:check` at the root (Prettier).
- **Contest configs are frozen at `create`** (panel, prompts, keyword hash, similarity
  config, request settings) and self-validate their hashes on every parse. There is no
  in-place edit by design — a config change means `delete --force` and re-create.
- **Everything is resume-safe except `create`:** re-running a pipeline command skips
  finished work via unique constraints. Refused operations (`reset`/`publish`/`dq` in the
  wrong phase) exit nonzero.
- **Embargo:** finishing a bracket does not publish it. `publish` lifts the embargo (and
  reveals the keywords); `reset` re-embargoes. The web gates everything server-side on
  `results_published_at <= now`.
