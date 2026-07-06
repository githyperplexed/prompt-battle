# Runbook — Running a Contest

Operational guide for running one contest end to end. For the contest rules see
[rules.md](rules.md); for the panel/models see [config.json](config.json); for the judge
prompts see [prompts/](prompts/); for how a result is independently audited see
[verification.md](verification.md).

**Status legend:** ✅ implemented · 🚧 stub (scaffolded, not yet functional) · ⬜ not built yet

## Prerequisites

- **Bun** installed; run `bun install` at the repo root.
- **Env vars** in the repo-root `.env` (auto-loaded):
  - `DATABASE_URL` — Postgres connection (Railway). ✅
  - `OPENROUTER_API_KEY` — scoring; needed by `score` and `advance`. ✅
  - `YOUTUBE_API_KEY` — comment ingest; needed by `ingest`. ✅
  - `OPENAI_API_KEY` — content moderation at ingest, embeddings for the similarity pass;
    needed by `ingest` and `cluster`. ✅
  - `EXCLUDED_CHANNELS` — optional; comma-separated `@handles` / `UC…` ids to exclude (owner, mods).
  - `LATITUDE_API_KEY` / `LATITUDE_PROJECT_SLUG` — optional; both enable Latitude AI telemetry for
    `score`, `advance`, and `smoke` (see [Telemetry](#telemetry-optional)). Absent → tracing is off.
- **Database migrated:** `bun run db:migrate`. (Schema changes: the maintainer runs
  `db:generate` + `db:migrate` — do not run them automatically.)

## Telemetry (optional)

`score`, `advance`, and `smoke` emit OpenTelemetry traces to [Latitude](https://latitude.so) for
live cost/latency/trace visibility while running batches and tuning judge prompts. It is **opt-in
and credentials-based**: set both `LATITUDE_API_KEY` and `LATITUDE_PROJECT_SLUG` to enable; with
either absent, the Vercel AI SDK falls back to a no-op tracer and inference is unchanged. The worker
flushes buffered spans on exit, so short-lived CLI runs don't drop traces. Each judge call is traced
as `score-entry` / `compare-entries` with `contestId`, `entryId`/`matchupId`, and `modelId` metadata.

This is **live observability layered on top of** the durable per-call audit already persisted to
Postgres (`score.audit`, `comparison.audit`) — Postgres remains the authoritative, auditable record
(rules.md §9); Latitude is not a source of truth for results.

> **⚠️ Data retention (compliance).** Traces are captured with full inputs **and** outputs, so entry
> comment text is sent to Latitude. YouTube API Terms require comment data to be deleted or refreshed
> within **30 days** — configure Latitude's retention to ≤30 days (or purge on that cadence). This is
> a Latitude-side setting, not enforced by this repo.

## Where each step runs

- **`ingest` is time-sensitive** — it snapshots comments at or just after the 168h cutoff.
  The worker rejects early runs, refuses incomplete YouTube comment-history fetches, excludes
  later posts, and disqualifies comments YouTube marks as edited after the cutoff. It prepares
  the full snapshot first, including moderated comments, then commits entries plus the status
  flip in one locked database transaction. Cron mode (`worker ingest --due`) is implemented ✅
  — idempotent via contest status, one failing contest is reported and skipped so it can't
  starve the rest, and the run exits nonzero on any failure. Deploy it unattended as a
  **Railway cron service** (see [Deploy the ingest cron](#deploy-the-ingest-cron-railway)). ✅
- **`score` and `advance` run locally** — resume-safe batches you trigger by hand. The
  workload is LLM-bound, so running from a laptop against the Railway DB is fine.

## Deploy the ingest cron (Railway)

A Railway service runs `ingest --due` every 30 minutes so the snapshot fires unattended once a
contest passes its cutoff. Timing slack is safe by design: the worker rejects early runs, the
cutoff excludes later comments no matter when the snapshot actually executes, and overlapping or
skipped ticks are covered by idempotency — the only cost of a longer poll is a slightly wider
window for a commenter to delete their entry between cutoff and capture.

The service config is committed at [worker/railway.json](worker/railway.json): start command
`bun run worker ingest --due`, schedule `*/30 * * * *`, and **restart policy `NEVER`** — ingest
deliberately exits nonzero on failure, and the default on-failure policy would rerun it in a
tight loop against the YouTube quota. The next scheduled tick is the retry. (Railway cron
constraints, all already satisfied: the process must exit on its own — the CLI closes the pool;
runs still active at the next tick are skipped; execution time can drift by a few minutes;
schedules are UTC.)

One-time setup in the Railway dashboard:

1. **New service from the GitHub repo.** Leave the root directory at the repo root (the worker
   needs the Bun workspace); Railpack detects Bun automatically.
2. **Point it at the config file:** Settings → Config-as-code → `/worker/railway.json`. This is
   what keeps the cron schedule off any other service deployed from this repo.
3. **Variables:** `DATABASE_URL` (reference the Railway Postgres over the private network),
   `YOUTUBE_API_KEY`, `OPENAI_API_KEY` (moderation), `EXCLUDED_CHANNELS`, and `KEYWORD_SECRETS`
   (below). `OPENROUTER_API_KEY` and the Latitude vars are **not** needed — the CLI imports
   per command, and ingest makes no judge calls.
4. Optional: set watch paths to `/worker/**` and `/db/**` so web-only pushes don't rebuild it.

**`KEYWORD_SECRETS` — required.** The gitignored `secrets/<videoId>.json` files never reach a
Railway build, but ingest must verify the keyword commitment and validate entries against the
real keywords. Provide the secret as a JSON map in the `KEYWORD_SECRETS` variable:

```json
{ "<videoId>": { "keywords": ["ONE", "TWO", "THREE"], "salt": "<the salt>" } }
```

A local secrets file always takes precedence; the env var is the fallback for deployed
environments. Either source is verified against the contest's committed keyword hash before any
external API work, so a wrong or stale value fails closed. Add each new contest's entry to the
map when you `create` it, and remove entries after the reveal.

## Run order

Run these in sequence for one contest. **Every pipeline command is resume-safe** — re-running
picks up where it left off (completed work is skipped via unique constraints). The one
exception is `create`, which refuses to run twice for the same video rather than resuming.

> **Where do things stand?** `bun run worker status` (or `status --contest <id>`, `--json`)
> prints a read-only snapshot of a contest — phase, field counts, scoring coverage, bracket
> winner, pinned config hashes — and the next command to run (the `next` field in `--json`).
> It only needs `DATABASE_URL`, so it's the first thing a new operator or agent should run
> to orient.

### 1. Create the contest ✅

Put this contest's keywords and salt in a gitignored secrets file `secrets/<videoId>.json`
(format in `secrets/example.json`) and mirror them into the cron service's `KEYWORD_SECRETS`
variable (see [Deploy the ingest cron](#deploy-the-ingest-cron-railway)), then:

```bash
bun run worker create --video <id> --published-at <iso> [--delay-hours 168] [--snapshot-at <iso>]
```

Computes a salted hash of the keywords and stores **only the hash** on the contest — the
words stay uncommitted yet verifiable after the reveal. It also freezes a versioned judging
configuration containing the three-model panel and exact score/compare prompt templates with
their hashes. Later commands validate and use only this stored configuration. `snapshot-at`
defaults to `published-at + delay-hours` (168h); the two flags are mutually exclusive.
Timestamps must be ISO with an explicit offset (`Z` or `±hh:mm`) — offset-less strings would
parse as local machine time. Prints the new contest id used by later steps.

### 2. Snapshot the comments ✅

```
bun run worker ingest --contest <id>     # snapshot one contest manually
bun run worker ingest --due              # cron mode: snapshot any contest past its cutoff
```

Optional flags (defaults match the engine constants):

- `--max-entries <n>` — cap eligible entries (default `10000`).
- `--max-comments <n>` — cap the fetch window (default `100000`); the snapshot aborts whenever
  the cap truncates the history (mid-page or with pages remaining) rather than freezing a
  partial field.
- `--skip-moderation` — **testing only**; bypasses the OpenAI content screen (no `tos`
  disqualifications). It prints a warning; never use it for a real contest.

Fetches all top-level comments, validates each (length 50–3,000, all 3 keywords, no URLs,
one-per-channel by earliest timestamp, no post-cutoff edit, OpenAI content moderation →
`tos`), de-duplicates comments YouTube returns on overlapping pages, and freezes them as
`entry` rows — eligible and disqualified-with-reason. The run reports a
`fetched / after-cutoff / duplicates / unique / stored / eligible` breakdown. Comments
published after the cutoff are not entries; comments edited after it are stored with
`edited_after_cutoff` and are not sent to moderation (their current text is not the snapshot
text). Otherwise-eligible comments beyond `--max-entries` are stored as disqualified
`over_cap`, keeping the archive complete. Publication/update exactly at the cutoff is
accepted. The contest's actual capture start is stored in `captured_at`. Run at or just after
the cutoff. Affiliated accounts to exclude come from `EXCLUDED_CHANNELS` (handles resolved to
channel ids via the API); a handle that fails to resolve aborts the snapshot rather than
freezing a field with an affiliated account still eligible.

Before any external API call, ingest validates the stored contest configuration and verifies
that `secrets/<videoId>.json` still produces the keyword hash committed at creation. YouTube
fetching must exhaust comment pagination within the 100,000-comment safety cap; if another
page remains at that cap, ingest aborts rather than freezing a partial field. OpenAI
moderation completes before the transaction starts; moderation batches are paced and retry
transient `429`/`5xx` responses, including `Retry-After`, so a moderation failure leaves the
contest `open` with no partial snapshot commit.

#### Manual disqualification (optional, before scoring)

After ingest and **before** scoring, you can disqualify entries by hand — but only for the two
operator-judgment reasons the rules already allow: **affiliated** accounts and **TOS** violations
the automated moderation missed (rules §3). Mechanical reasons (length, keywords, URL) are computed
at ingest and cannot be applied here.

```
bun run worker dq --contest <id> --reason affiliated --channel <@handle|UC…,…> --note "<why>"
bun run worker dq --contest <id> --reason tos --comment <ytCommentId,…> --note "<why>"
```

- `--note` is **required** — the operator's justification is stored on each removed entry (`dq_note`)
  as the audit trail. A non-null note also marks the DQ as manual (automated/ingest DQs leave it
  null), so the note is the one bit of provenance that distinguishes a hand-issued removal.
- `affiliated` removes **every** entry from the given channel(s); `@handles` are resolved to channel
  ids via the YouTube API — an unresolvable handle or API failure aborts the command before any
  change is made. Raw `UC…` ids skip resolution entirely.
- `tos` removes the specific comment(s) by YouTube comment id. There is no channel promotion — the
  removed entry is simply out.
- Only valid while the contest is **`snapshotted`**: scoring reads eligible rows, so a DQ here drops
  entries with no rescoring. Once scoring has begun, `reset --to snapshotted` first, then re-`dq`.
  A refused DQ (wrong phase) exits nonzero.
- It reports how many entries changed and warns about any handle/id that matched no eligible entry
  (warnings name the handle you typed, not the resolved channel id).

### 3. Score the field ✅

```
bun run worker score --contest <id>
```

Scores every eligible entry once per model (3 models), in isolation, storing per-model
rubric scores plus available model usage/finish audit metadata. ~10k × 3 calls — the bulk of the cost. Resume-safe via the unique
`(entry, model)` constraint; runs ≤10 concurrent at ≤5 req/s and caches the judge prompt.
Individual failures leave the contest in `scoring` and make the command exit nonzero; re-run
until every eligible entry has exactly one score from each panel model and the contest reaches
`scored`.

### 4. Cluster near-duplicates ✅

```
bun run worker cluster --contest <id>
bun run worker cluster --contest <id> --store-vectors   # archive vectors for exact replay
```

Needs `OPENAI_API_KEY` (embeddings) and the contest's `secrets/<videoId>.json`, which is
re-verified against the committed keyword hash before any API call — same gates as ingest.

Computes embeddings over keyword-stripped entry text, finds hard near-duplicates using the frozen
semantic + lexical thresholds, and stores each entry's cluster, nearest earlier match, similarity
scores, and originality penalty. The pass is all-or-nothing: a failed first run leaves
`similarity_computed_at` null; a failed re-run leaves the previous complete pass in place. Either
way `advance` re-derives the similarity fingerprint and refuses to run against stale or missing
similarity data. Prefer `--store-vectors` for a real contest — hosted embedding models can drift
behind their slug, and the archived vectors are what make the pass exactly replayable. Inspect the
printed cluster report before advancing.

### 5. Run the bracket ✅

```
bun run worker advance --contest <id>
```

Ranks entries by adjusted absolute score (raw mean total minus near-duplicate originality penalty),
takes the **top 64**, seeds them, stores a `bracket_fingerprint` for that seeded field, and runs the
single-elimination bracket (3 models × both orderings per matchup, majority vote, deadlock to the
higher seed) down to one winner. With fewer than 64 eligible entries the bracket shrinks to the
next power of two with first-round byes for the top seeds — a field of N entrants plays N − 1
matchups, and `status` sizes its matchup count accordingly. Materializes per-entry
`raw_absolute_score`, `originality_penalty`, `absolute_score` / `rank` / `seed` / `final_round`
and the contest's `winner_entry_id`, then sets status `complete`. Resume-safe only when the
recomputed seeded field matches the stored fingerprint; ~378 calls for a full field.

Database constraints keep score and matchup rows inside their contest boundary. The worker also
asserts each stored or fresh bracket choice is one of that matchup's two entries before it can
resume or persist a winner. Denormalized comparison-pair database triggers are intentionally
deferred while comparison writes remain confined to this worker path.

#### Recovering from bracket fingerprint mismatch

If `advance` fails with a bracket fingerprint mismatch, stop. It means existing bracket state
belongs to a different top-64 seed field than the one current scores/ranking now produce. Do
not keep rerunning; choose which timeline is authoritative:

- **Old bracket is authoritative:** use this if the bracket was already public, or if the
  existing partial bracket is the run you want to preserve. Restore the score rows and any
  ranking-affecting code/config that produced the stored fingerprint, then rerun normal
  `advance`.
- **New scored or clustered field is authoritative:** use this only when the old bracket rows are private,
  partial, or known bad. Reset the bracket explicitly, then rerun `cluster` and `advance`:

```bash
bun run worker reset --contest <id> --to scored
bun run worker cluster --contest <id>
bun run worker advance --contest <id>
```

`reset --to scored` deletes matchups/comparisons and similarity rows, clears the materialized
ranking/bracket columns, and clears `winner_entry_id`, `bracket_fingerprint`, and
`similarity_fingerprint` (it does not touch scores). It is valid from `scored` (a partial bracket)
or `complete` (a finished one).

### Resets & deletion

`reset --contest <id> --to <stage>` unwinds a contest to an earlier stage, deleting everything
produced after it (in one locked transaction). A refused reset (invalid stage transition) exits
nonzero. Every reset also **re-embargoes**: it clears the publish timestamp and strips revealed
keywords from the config, so a re-run contest cannot go public — or leak the reveal — without an
explicit new `publish`. Levels cannot strand downstream rows:

- `--to scored` — drop the bracket and similarity pass (from `scored` or `complete`); keeps scores.
- `--to snapshotted` — drop scores and the bracket (from `scoring`/`scored`/`complete`); keeps
  the frozen field.
- `--to open` — drop the frozen field and everything after (from `snapshotted` onward); re-run
  `ingest` to re-snapshot.

To discard a contest entirely (e.g. to change the pinned prompts/panel, which are frozen at
`create`), use `delete --contest <id> --force` — it cascades all entries, scores, and bracket
rows. There is no in-place config edit by design.

### 6. Publish results ✅

The web UI reads contest state live. The ranked leaderboard (`scored`) is public as soon as scoring
finishes, but the bracket, champion, and verification record (`complete`) are **embargoed** until
results are explicitly published — the public site shows a "bracket locked until the reveal" screen
so finishing the bracket privately doesn't spoil the reveal video. Lift the embargo when the video
is live:

```
bun run worker publish --contest <id>                 # publish now (requires scored/complete)
bun run worker publish --contest <id> --at <iso>      # publish at a specific time
bun run worker publish --contest <id> --unpublish     # re-embargo
```

`--at` must be an ISO timestamp with an explicit offset (`Z` or `±hh:mm`). A future `--at` stays
embargoed until that moment — `status` reports `published: no` and the site stays locked until the
time passes. A refused publish (wrong phase) exits nonzero.

Publishing also reveals the keywords + salt into the contest config (read from the local
`secrets/<videoId>.json`, so that file must be present when you publish) — this is what lets anyone
re-derive the committed keyword hash, and it surfaces on `/rules`. The secret is verified against
the committed hash first; a reveal that would not re-derive the published hash is refused.
`--unpublish` strips the revealed keywords again.

Still to build: export the full audit bundle for the public record —

- contest config (`panel`, prompt hashes/text, keyword hash, judge request settings);
- revealed keywords and salt;
- captured entries and disqualification reasons;
- per-model scores with usage/finish metadata;
- matchup decisions with usage/finish metadata;
- similarity config, clusters, nearest-earlier links, similarities, and originality penalties;
- bracket fingerprint and winner.

## Smoke test (optional)

```
bun run worker smoke
```

Scores one hardcoded sample entry with all three default-panel models and runs one pairwise
comparison — **4 paid OpenRouter calls** — printing each call's output, latency, and cost. It
reads and writes no contest data, but needs `DATABASE_URL` (client import) and
`OPENROUTER_API_KEY`, and emits Latitude traces when telemetry is configured. Use it to
sanity-check credentials, the panel, and prompt plumbing before a costly scoring run.

## Notes

- **Resume / crash recovery:** re-run the same command — finished work is skipped.
- **Keywords** are supplied per contest and never committed (a watch-gate, see rules.md
  §5).
- **Costs:** the absolute scoring pass dominates; the bracket is negligible (~378 calls).
- This runbook is kept in sync as each pipeline step lands — flip the 🚧/⬜ markers to ✅
  when a step becomes functional.
