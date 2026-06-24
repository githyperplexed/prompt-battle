# Development Log

The order this project was built in, with the key decisions and findings at each step.
This is a narrative build history (not a release changelog) — meant for new contributors,
and for recounting the development process.

The contest engine runs a YouTube comment game: viewers comment a prompt that tries to
convince an AI panel it should win; the engine snapshots the comments, scores them with
three models, and runs a single-elimination bracket to one winner. See `rules.md` for the
game and `RUNBOOK.md` for how to run it.

---

## Phase 0 — Concept & rules

Started from the game idea and pressure-tested it. Key design decisions:

- **Premise: "convince the AI."** Manipulation isn't cheating — it's the sport. This made
  prompt injection the game rather than a bug to fully prevent.
- **Score-once, then a bracket.** Rejected the original "repeated pools" idea: scoring is
  deterministic and isolated, so re-scoring survivors is pointless. Settled on one absolute
  scoring pass → rank → **top 64** → seeded single-elimination bracket.
- **Three-model panel** (different providers) for defensible, cross-checked judgments.
- **Anti-injection by design:** each entry judged in isolation as untrusted, delimited data;
  structured output only; the rubric scores naked overrides _low_.
- Locked the rule constants: **50–1,000** chars, **10,000**-entry cap, **3** hidden keywords
  (a watch-gate), one-entry-per-channel, **168h** snapshot, prize = a YouTube Short.

Wrote `rules.md`. Later refinements: top-16 → **top-64** bracket; removed a vestigial
"committed random seed" (isolation + both-orderings made it meaningless); reframed §7.5/§7.6
around single-pass scoring; winner-contact window = 7 days.

## Phase 1 — Judge prompts

Wrote the two prompt templates before any code, since they're the heart of the system:

- `prompts/judge-score.md` — absolute scoring (4 rubric dimensions × 0–25), with calibration
  anchors and the anti-gaming clause.
- `prompts/judge-compare.md` — pairwise/bracket comparison (pick A or B).

Both use **hard instruction/data separation**: a random per-request nonce delimits the
untrusted entry; the system message holds the trusted instructions. Output shape is left to
a Zod schema (AI SDK), so the prompts don't restate JSON. Ran two audit passes and tightened
wording (format consistency, "reward craft not compliance", standing/seed claims ignored in
the compare prompt).

## Phase 2 — Architecture

- **Bun monorepo**, three packages: `db` (shared Drizzle schema + client), `worker` (Bun CLI:
  create / ingest / score / advance), `web` (SvelteKit UI, not yet built).
- **No queue (BullMQ/Redis).** A per-contest batch doesn't need it — concurrency via a
  limiter, retries via the AI SDK, and **resume via Postgres checkpoints** (unique
  constraints) cover it.
- **OpenRouter** for the panel (one API, three providers) — deliberately _not_ OpenRouter
  Fusion, which collapses the panel into one judge and breaks the independence/auditability.
- **Local-first worker** against the Railway DB; only `ingest` (time-sensitive) is a
  candidate for an unattended **Railway cron** (`ingest --due`, poll-and-guard pattern).

## Phase 3 — Scaffold (`b091eda`)

Root Bun workspace, Prettier (tabs, double quotes, no trailing commas, width 100), base
tsconfig, `CONTRIBUTING.md`, workspace stubs. Bun upgraded to latest.

## Phase 4 — Database (`94456cf`)

`db` package: Drizzle ORM with the **`pg`** driver (per existing preference), a `createDb()`
factory plus a default client, `drizzle.config.ts` using `casing: "snake_case"` and `dotenv`
(root `.env`), and the schema — `contest`, `entry`, `score`, `matchup`, `comparison` — with the
resume keys (`unique(entry, model)`, `unique(matchup, model, ordering)`). Verified against the
maintainer's prior `wade-app` setup, then adapted (a shared package uses `process.env`, not
SvelteKit `$env`). Migrations are run by the maintainer, never automatically.

## Phase 5 — Worker scaffold / W1 (`f6c9741`)

CLI shell with `ingest`/`score`/`advance` stubs. Two patterns locked in early: **env preload**
as the first import (so the db client sees `DATABASE_URL`), and **clean exit** via `pool.end()`
(the Railway cron requires the process to terminate).

## Phase 6 — Scoring primitives / W2 (`853bb3d`)

OpenRouter model factory, the concatenation-safe prompt templating (the audit requirement, in
code), Zod score/compare schemas, `scoreEntry`/`compareEntries`, and a `smoke` command.

**Finding:** Zod v4's `.int()` emits `minimum`/`maximum` in the JSON schema, which **Anthropic's
structured output rejects over OpenRouter**. Fix: send a plain `z.number()` schema and enforce
the 0–25 integer range in code (`clampScore`). gpt-5.5 / Gemini tolerate bounds; Anthropic
doesn't — so the lowest-common-denominator schema is correct for a 3-provider panel.

## Phase 7 — Conventions & structure (`2683742`, `d9a6b61`)

Codified the maintainer's style in `CONTRIBUTING.md`: **`const` arrow functions** (no `function`
declarations), **breathing-room line breaks** (blank line before control flow after a
declaration group, and before `return`), and **no unnecessary comments** (explain non-obvious
_why_ only). Reorganized the worker into **`services/`** (I/O + orchestration) and
**`utilities/`** (pure helpers) — later documented as an explicit convention (`2b151cc`).

## Phase 8 — Ingest / W3 (`f63003a`)

- **`create` command:** registers a contest and stores a **salted hash** of the keywords; the
  keywords + salt live in a gitignored `secrets/<videoId>.json` so they're verifiable after
  the reveal without being committed. (Hit the classic gitignore gotcha — `secrets/` can't
  re-include `example.json`; fixed with `secrets/*`.)
- **YouTube fetch:** raw Data API v3 via `fetch`, referencing `wade-external` for the
  fetch/Zod pattern, then adding what it lacked — **pagination** (`nextPageToken`), per-item
  lenient parsing, and `commentsDisabled` vs `quotaExceeded` handling. No Redis quota tracker.
- **Validation** (pure utilities): length, all-3-keywords (whole-word), URL detection,
  one-per-channel by earliest timestamp, affiliated exclusion via `EXCLUDED_CHANNELS`
  (`@handles` resolved to channel ids via the API).
- **`snapshot` service:** validates, dedups, caps at the first 10k by timestamp, and freezes
  entries (eligible + disqualified-with-reason), idempotent via `onConflictDoNothing`.

## Phase 9 — Scoring pass + moderation / W4 (`4641b2d`)

- **`score` service:** scores every eligible entry × 3 models through a **Bottleneck** limiter
  (≤10 concurrent, 200 ms spacing = 5 req/s), resume-safe by skipping done `(entry, model)`
  pairs, **catch-log-continue** per call. Split into named step functions.
- **Prompt caching:** the identical judge instructions go in a cache-marked system message.
  Verified live — **~1,558 cached tokens per Opus call**, so only the entry bills at full rate.
  Needed `allowSystemInMessages: true` (our system message is trusted, so the SDK's
  injection warning is a false positive here).
- **OpenAI moderation at ingest:** flags policy-violating comments as a `tos` disqualification
  _before_ scoring — closing the rules-vs-code gap (§3 "violations removed before judging").

## Phase 10 — `$src` path alias (`0afd262`)

Added a `$src/*` → `worker/src/*` alias (tsconfig `paths`, **no `baseUrl`** — it's deprecated
in TS 6). Bun resolves it natively at runtime; verified at compile and runtime across every
command chain. **`db` deliberately kept on relative imports** — path aliases resolve against
the _compiling_ project's tsconfig, so a shared package using `$src` would break its consumers'
typecheck (and drizzle-kit's bundler).

## Phase 11 — Result columns (`1d5106d`)

Added materialized-result columns so the public site is a simple query, not a recompute:
`entry.absolute_score` / `rank` / `seed` / `final_round`, and `contest.winner_entry_id`. All
populated when `advance` finishes.

## Phase 12 — Bracket / W5 (`5e5e24e`)

- **Pure bracket math (utilities):** §7.6 ranking comparator, standard `seedOrder` (so #1/#2
  meet only in the final), `nextPowerOfTwo`, and the both-orderings majority `tallyMatchup`
  (a model votes only if consistent across orderings; deadlock → higher seed). Unit-tested.
- **`advance` service:** `rankAndSeed` (aggregate the per-model totals → mean = absolute score;
  materialize rank/seed for all eligible) → `runBracket` (round-by-round, **byes** for sub-64
  fields, limiter-paced comparisons) → `finalize` (set `final_round`, `winner_entry_id`,
  status `complete`). Resume-safe via decided matchups + the comparison unique key.

This completed the worker pipeline: **create → ingest → score → advance.**

---

## Phase 13 — Contest input pinning

Made the contest record authoritative for every judging input. Creation now stores a
versioned configuration containing the exact three-provider panel and full score/compare
prompt templates with integrity hashes. Scoring, completeness checks, and bracket comparisons
all use that stored configuration rather than live repo defaults. Ingest verifies the local
keyword secret against the contest's committed hash before external API work. Malformed,
tampered, or legacy unversioned configuration fails closed with no fallback.

---

## Notable cross-cutting decisions

- **Resume everywhere.** Every command is idempotent and re-runnable; progress is checkpointed
  in Postgres via unique constraints, so a crash mid-run is just a re-run.
- **Pure vs I/O split** is enforced, not just stylistic — it's what keeps the logic unit-testable
  without a database.
- **The maintainer runs all `db:generate` / `db:migrate` and all `git push`** — never automated.

## Not yet done

- A real end-to-end dry run on a small video (ingest → score → advance writing live rows).
- The `web` UI (display entries, scores, rounds, champion).
- Deployment (Railway web service + the `ingest --due` cron).
