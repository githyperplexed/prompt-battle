# Development Log

The order this project was built in, with the key decisions and findings at each step.
This is a narrative build history (not a release changelog) — meant for new contributors,
and for recounting the development process.

The contest engine runs a YouTube comment game: viewers comment a prompt that tries to
convince an AI panel it should win; the engine snapshots the comments, scores them with
three models, and runs a single-elimination bracket to one winner. See `rules.md` for the
game and `RUNBOOK.md` for how to run it.

---

## Current — Similarity thresholds tuned against a probed copy gradient

Probed the near-duplicate gates with a planted field run through the real pipeline pieces
(normalize → embed → cluster): an original, synonym-swapped copies at increasing cadence
(every ~8th, ~5th, ~3rd, ~2nd word), a full AI paraphrase, and two innocent same-sentiment
entries. Findings, at 256-dim `text-embedding-3-small`:

- A hard trip requires BOTH gates, so the net is only as wide as the stricter one — and the
  original 0.92 cosine gate was stricter than the 0.6 lexical gate for exactly the realistic
  attack: an every-8th-word tweak kept jaccard at ~0.72 (unambiguously a copy) but dropped
  cosine to ~0.91 and walked.
- A full paraphrase measures ~0.71 cosine — statistically indistinguishable from the innocent
  pair (~0.69). No threshold separates "AI rewrite of a specific entry" from "two strangers
  with the same sentiment"; paraphrase is mechanically unpoliceable and stays permitted.
- Innocents sit at ≤0.51 cosine and <0.1 jaccard — a wide dead zone below every copy variant.

Defaults moved from 0.92/0.6 to **0.85/0.5**: all tweaked copies through every-5th-word are
now caught (and dock correctly, transitively, with the own-originality cap), while escape now
requires rewriting roughly every third word — by which point jaccard has collapsed to ~0.23
and the text is a genuine paraphrase. The probe was a one-off script (deleted); it costs
fractions of a cent in embeddings and is easy to recreate from this description if the
embedding model ever changes. Frozen configs are untouched — new defaults apply from the next
`create`.

## Phase 23 — Precedence reset-on-edit: closing the timestamp-sniping hole

The near-duplicate pass and the §7.6 tie-break both decided "who came first" by YouTube's
`publishedAt`, while the rules allow free editing until the cutoff. Those two facts combined
into a reliable exploit: post a minimal placeholder in hour one, wait for the field's best
comment, edit the placeholder into a near-copy on day six — and the clustering pass would
have handed the copier full originality credit and pushed the penalty (plus every tie-break)
onto the true author, likely ranking the copy _above_ the original.

The fix is a single concept applied everywhere order matters: an entry's **precedence
timestamp** is its `updatedAt` — the last-edit time, identical to `publishedAt` when the
comment was never touched. Editing resets your place in line; not editing costs nothing.
Clustering order, the similarity-input fingerprint payload, and the ranking tie-break (worker
and the web's hand-mirrored copy) all switched from `publishedAt` to it, and rules.md now
carries a loud §2 warning, because the rule has one sharp edge the API makes unavoidable:
YouTube exposes no revision history, so a typo fix after being copied genuinely hands the
copier precedence. That failure needs the victim's voluntary edit; the old one needed only
the attacker's. A stronger fix — interim captures during the entry week to build our own
revision history — is recorded under "Not yet done."

Note: the fingerprint payload key changed (`publishedAt` → `precedenceAt`), so this must not
be deployed mid-contest — an in-flight contest's stored similarity fingerprint would no
longer re-derive at `advance`.

## Phase 22 — Refusal handling: unscorable entries & bracket abstention

Decided what happens when a panel model _refuses_ to judge. The AI SDK's no-output error (a
response arrived but produced nothing schema-valid) is the classifier: it separates a model
declining from a request never succeeding, so transient failures (network/429/5xx) stay
retryable while a refusal confirmed a few times running is treated as deterministic. A scoring
refusal disqualifies the entry as `unscorable` and excludes it from the coverage gate — the
alternative (ranking on a partial panel, or imputing a score) would bias the field, and one
un-judgeable entry must not hold the contest in `scoring` forever.

Review of the first cut surfaced three gaps, all fixed in the follow-up:

- **Mass-DQ guardrail.** The refusal signal is only entry-level evidence while refusals are
  rare — a broken judge prompt, schema, or token cap makes _every_ entry refuse, and the naive
  path would have disqualified the whole field and flipped the contest to `scored` with nobody
  in it. A run that confirms refusals for more than max(5, 1% of the field) now disqualifies
  nothing and leaves every pair retryable; `score --allow-unscorable <n>` accepts reviewed
  disqualifications for a single run (needed because manual `dq` is locked to pre-scoring, so
  a tripped guardrail previously had no clean exit).
- **Durable evidence.** The refusing model(s) and final error persist on the entry as
  `dq_evidence` — telemetry retention is 30 days, and a public-verifiability posture can't
  have DQ justifications evaporating. `dq_note` stays human-only.
- **Bracket abstention.** The same failure existed unhandled in matchups. A model that refuses
  a comparison abstains for the whole matchup: _all_ its votes there are discarded — counting
  the surviving ordering would quietly break the both-ways position-bias rule — the remaining
  majority decides, and a full deadlock still goes to the higher seed. No comparison row is
  stored, so the abstention is visible in the published record as the model's missing vote.

Synced rules.md (§3 `unscorable`, §7.5 abstention), the runbook (transient-vs-refusal,
guardrail, matchup refusals), and verification.md (`unscorable` as a scoring-time outcome with
stored evidence, not a rule judgment).

## Phase 21 — Full-repo audit & pre-launch fixes

Ran a structured audit of the whole engine — rules ↔ code adherence, every CLI command, and
runbook accuracy — then fixed everything it surfaced. The headline finding: the "video-specific"
judge prompts had been written _inside_ the prompt files' HTML header comments, which the loader
strips — they could never reach a model. Reverted them (they were a one-off dev test) and added a
loader test that asserts the live sections are what actually loads, plus CRLF→LF normalization so
the pinned prompt hashes are reproducible from any checkout. The rest, by theme:

- **Snapshot integrity.** The fetch cap now aborts on mid-page truncation, not just
  pages-remaining (the one real data-loss path found); an affiliated `@handle` that fails to
  resolve aborts ingest instead of warning (a quota error could otherwise freeze a field with
  the owner still eligible); over-cap entries are archived as `over_cap` instead of vanishing
  (rules §6 promises a complete record); post-cutoff-edited comments skip moderation and DQ as
  `edited_after_cutoff` — a flag on unrecoverable text isn't attributable to the entry.
- **Rule mechanics.** Keyword matching went Unicode-aware (`\b` is ASCII-only — "déjà" could
  never match); URL detection catches `youtu.be/…` (the likeliest link in a YouTube comment)
  without false-positive prose; both were previously untested and now are.
- **Determinism.** Ranking gained an entry-id final tie-break (a full tie at YouTube's
  second-granularity timestamps could recompute a different field on resume and trip the
  bracket fingerprint for nothing), and the adjusted score is now the exact `raw − penalty`
  from §7.4 — the old re-round coarsened the top-64 cut. Resume also cross-checks stored
  matchup pairs against the recomputed bracket.
- **Embargo integrity.** `reset` now re-embargoes (clears the publish timestamp, strips
  revealed keywords) so a re-run bracket can't go public without an explicit `publish`; and
  `publish` verifies the secrets file against the committed hash first — a reveal that
  wouldn't re-derive the published hash is refused.
- **Operator safety.** Timestamps require an explicit offset (offset-less ISO parses as local
  time — a silent multi-hour embargo error); refused `reset`/`publish`/`dq` exit nonzero;
  `ingest --due` isolates per-contest failures so one broken contest can't starve the cron
  queue; `status` sizes expected matchups to the real entrant count and treats a scheduled
  future publish as still embargoed.

Synced `rules.md` (sub-64 brackets shrink with byes; `over_cap` listed in §4) and the runbook
(cluster's real prerequisites, a `smoke` section with its cost warning, the new behaviors) to
match. Two schema changes await migration: the `over_cap` DQ reason and a unique `videoId`.

Follow-up: the `/rules` verification panel now derives every step's "Verifiable now" tag from
a time-aware published flag (steps 3–4 were hardcoded, and a scheduled future `publish` leaked
the revealed keywords onto `/rules` before the embargo lifted — both fixed), with each step
rewritten as an explicit Check/Proves pair. Wrote `verification.md` — the full audit guide with
the commitment timeline and exact hash/fingerprint formulas — and rebuilt `AGENTS.md` into a
repo map (what each essential document is for and how the pieces relate).

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

## Phase 14 — Pre-launch hardening

A pass of correctness/safety fixes before any live run:

- **Atomic ingest.** All prep (fetch, moderation, row-building) runs before a single locked
  transaction that replaces entries and flips status together — no partial/hybrid frozen field
  if a run crashes or a second worker overlaps. Moderation retries transient `429`/`5xx` and
  honors `Retry-After`; a moderation failure leaves the contest `open`.
- **Bracket fingerprint.** `advance` fingerprints the ranked top-64 field and refuses to resume
  bracket rows belonging to a different scored field, instead of grafting a stale bracket onto
  new seeds.
- **Incomplete-fetch refusal.** Ingest aborts rather than freeze a partial field when the
  YouTube fetch can't exhaust pagination within the cap (newest-first order would drop the
  oldest comments).
- **Judge audit metadata.** Scoring/comparison record request settings, finish reason, usage,
  and provider metadata; docs reframed from "exact replay" to "independent auditability."
- **DB boundary constraints.** Composite foreign keys keep score/matchup rows inside their
  contest, and the bracket asserts every recorded/fresh choice is one of the matchup's two
  entries.

## Phase 15 — Operational commands & ingest controls

Made the pipeline safe to drive and recover by hand:

- **`reset --to <open|snapshotted|scored>`** unwinds a contest to an earlier stage, deleting
  only what later stages produced and refusing to skip levels (downstream rows are never
  stranded). Folds in the old bracket reset and also handles a finished (`complete`) contest.
- **`delete --contest <id> --force`** discards a contest and all its rows — the path for
  changing the prompts/panel, which are frozen at `create`.
- **Per-contest operation lock.** `score`/`advance` hold a Postgres advisory lock for their
  whole run; `reset`/`delete` fail fast if a job is active, closing the race where a reset could
  be undone by in-flight writes.
- **Ingest controls.** `--max-entries` / `--max-comments` caps and a testing-only
  `--skip-moderation`; ingest also de-duplicates comments YouTube returns on overlapping pages
  (a real bug the dry run surfaced) and reports a fetched/unique/stored breakdown.

## Phase 16 — Results embargo

Decoupled "pipeline finished" from "results public": a nullable `contest.results_published_at`
plus a `publish` command (with `--unpublish`). The web UI gates `scored`/`complete` behind it —
showing a "results locked until the reveal" screen and not even loading the leaderboard/bracket —
so finishing the bracket privately can't spoil the reveal video.

## Phase 17 — Web contest-status UI

Built the `web` SvelteKit app: one page that loads contest state server-side and renders a
phase-specific component tree (`open` → `snapshotted` → `scoring` → `scored` → `complete`, plus
`locked` / `draft` / `not-found`). Deep-indigo theme with gold as the prize accent, Lexend prose
and Space Mono numerals. Highlights — a live countdown, a judging-progress radial, a leaderboard
with the top-64 cut line and a per-entry 3×4 score matrix, and the 64→1 bracket with SVG elbow
connectors and a lazy per-matchup vote panel. Files split by kind (`types/`, `utilities/`,
server `services/`, kebab-case components); a dev-only `?phase=` override (clickable from the
stepper) previews any phase.

## Phase 18 — Web UI overhaul

A broad redesign and data-flow rework of the `web` app after the first pass:

- **Neutral dark theme.** Replaced the indigo/purple surface palette with a true-neutral dark ramp
  (the gold prize accent, ambient glow, and per-judge colors stay), and swapped the ad-hoc arbitrary
  Tailwind classes (`text-[13px]`, `z-[1]`, `color-mix(...)` colors, and the like) for standard
  tokens, opacity modifiers, `ring`/theme-token utilities, and a few scoped component styles.
- **Everything loads through the page server load.** Every list and bracket dataset now comes back
  with the initial page (score-free entry lists for snapshot/scoring, the full ranked leaderboard,
  and all preloaded matchup details), so nothing fetches separately. This let the ad-hoc `/api/*`
  endpoints (entry search/detail, matchup detail) and the standalone search components be deleted,
  and it moved embargo gating entirely into the load, so scores and bracket outcomes can no longer
  be pulled ahead of the reveal from any endpoint.
- **Full, searchable fields.** Snapshot and scoring render the whole field as a single searchable,
  `content-visibility`-virtualized list (the snapshot view badges disqualifications and withholds
  `tos` bodies from the payload). The scored leaderboard collapsed its tabs, pagination, and
  score-matrix drill-down into one searchable list that folds seed into the rank column.
- **Bracket + matchup rework.** Two-sided bracket that meets at the center final, drag-to-pan with a
  hidden scrollbar, and round labels pinned to the top of the viewport (synced to horizontal pan).
  The per-matchup votes and prompts collapsed into one card (round header, judge results, verdict,
  highlighted winner), and the verification record moved off the results page to `/rules` only.
- **Navigation & polish.** A loading skeleton fills the content area during navigation, a divider
  sits above the page content, the scrollbar gutter is always reserved so pages don't shift, times
  render in the viewer's local timezone, and the footer fingerprint is a copyable control.

## Phase 19 — Public phase navigation & selective embargo

Follow-on refinements to the web app after the overhaul:

- **Public phase navigation.** The stepper's `?phase=` selector is now public rather than dev-only —
  anyone can jump ahead or behind to any phase. What each phase _reveals_ still comes entirely from
  the server load, gated on the real contest status: a phase the contest hasn't reached renders a
  "hasn't happened yet" placeholder and loads no data, so browsing never surfaces anything early. A
  dev-only `?peek=true` bypasses the gate to inspect real data for any phase.
- **The ranked leaderboard goes public before the reveal.** Split the embargo so only the bracket,
  champion, and verification record (`complete`) wait for `publish`; the ranked leaderboard
  (`scored`) is public the moment scoring finishes. An unpublished `complete` contest lands on the
  public Ranked view with the bracket shown as "locked until the reveal."
- **Standardized phase headers & polish.** Every phase leads with a shared title + description block
  (with its "Phase N" marker); the stepper marks completed phases with a checkmark (including the
  terminal Complete once results publish); a dedicated lock-icon "entries closed / snapshot pending"
  panel replaces the countdown once entries close; times render in 12-hour local format; the
  entry-window length is derived from the real publish→snapshot gap; matchup judge labels reuse the
  shared judge chip; and the `/rules` hash fields are copyable like the footer fingerprint.

## Phase 20 — Near-duplicate originality pass

Added a deterministic similarity pass between scoring and bracket advancement. The judges still score
each entry in isolation, but the worker now clusters near-duplicates over the frozen field and applies
a bounded originality penalty to later copies before ranking and seeding. The similarity config is
hashed into the contest config, cluster decisions are stored for audit, and `advance` refuses to run
until the pass is complete for the current scored field.

---

## Notable cross-cutting decisions

- **Resume everywhere.** Every command is idempotent and re-runnable; progress is checkpointed
  in Postgres via unique constraints, so a crash mid-run is just a re-run.
- **Pure vs I/O split** is enforced, not just stylistic — it's what keeps the logic unit-testable
  without a database.
- **The maintainer runs all `db:generate` / `db:migrate` and all `git push`** — never automated.

## Not yet done

- A real end-to-end dry run on a small video, writing live rows (in progress).
- Publishing the audit bundle for the public record (the embargo + `publish` flag exist; the
  export of entries/scores/decisions does not).
- Deployment (Railway web service + the `ingest --due` cron).
- Interim captures during the entry week (periodic text hashes) to establish true first
  authorship regardless of edits — would soften reset-on-edit's typo-fix edge case.
