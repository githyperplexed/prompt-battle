# Runbook — Running a Contest

Operational guide for running one contest end to end. For the contest rules see
[rules.md](rules.md); for the panel/models see [config.json](config.json); for the judge
prompts see [prompts/](prompts/).

**Status legend:** ✅ implemented · 🚧 stub (scaffolded, not yet functional) · ⬜ not built yet

## Prerequisites

- **Bun** installed; run `bun install` at the repo root.
- **Env vars** in the repo-root `.env` (auto-loaded):
  - `DATABASE_URL` — Postgres connection (Railway). ✅
  - `OPENROUTER_API_KEY` — scoring; needed by `score` and `advance`. ✅
  - `YOUTUBE_API_KEY` — comment ingest; needed by `ingest`. ✅
  - `OPENAI_API_KEY` — content moderation at ingest; needed by `ingest`. ✅
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
  flip in one locked database transaction. It can run unattended as a **Railway cron service**
  (`worker ingest --due`, polled every ~10–15 min, idempotent via contest status). ⬜
- **`score` and `advance` run locally** — resume-safe batches you trigger by hand. The
  workload is LLM-bound, so running from a laptop against the Railway DB is fine.

## Run order

Run these in sequence for one contest. **Every command is resume-safe** — re-running picks
up where it left off (completed work is skipped via unique constraints).

> **Where do things stand?** `bun run worker status` (or `status --contest <id>`, `--json`)
> prints a read-only snapshot of a contest — phase, field counts, scoring coverage, bracket
> winner, pinned config hashes — and the next command to run. It only needs `DATABASE_URL`, so
> it's the first thing a new operator or agent should run to orient.

### 1. Create the contest ✅

Put this contest's keywords and salt in a gitignored secrets file `secrets/<videoId>.json`
(format in `secrets/example.json`), then:

```bash
bun run worker create --video <id> --published-at <iso> [--delay-hours 168] [--snapshot-at <iso>]
```

Computes a salted hash of the keywords and stores **only the hash** on the contest — the
words stay uncommitted yet verifiable after the reveal. It also freezes a versioned judging
configuration containing the three-model panel and exact score/compare prompt templates with
their hashes. Later commands validate and use only this stored configuration. `snapshot-at`
defaults to `published-at + delay-hours` (168h). Prints the new contest id used by later steps.

### 2. Snapshot the comments ✅

```
bun run worker ingest --contest <id>     # snapshot one contest manually
bun run worker ingest --due              # cron mode: snapshot any contest past its cutoff
```

Optional flags (defaults match the engine constants):

- `--max-entries <n>` — cap eligible entries (default `10000`).
- `--max-comments <n>` — cap the fetch window (default `100000`); the snapshot still aborts if
  pagination has more pages at the cap rather than freezing a partial field.
- `--skip-moderation` — **testing only**; bypasses the OpenAI content screen (no `tos`
  disqualifications). It prints a warning; never use it for a real contest.

Fetches all top-level comments, validates each (length 50–1,000, all 3 keywords, no URLs,
one-per-channel by earliest timestamp, no post-cutoff edit, OpenAI content moderation →
`tos`), de-duplicates comments YouTube returns on overlapping pages, and freezes them as
`entry` rows — eligible and disqualified-with-reason. The run reports a
`fetched / after-cutoff / duplicates / unique / stored / eligible` breakdown. Comments
published after the cutoff are not entries; comments edited after it are stored with
`edited_after_cutoff`. Publication/update exactly at the cutoff is accepted. The contest's
actual capture start is stored in `captured_at`. Run at or just after the cutoff. Affiliated
accounts to exclude come from `EXCLUDED_CHANNELS` (handles resolved to channel ids via the
API).

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
  ids via the YouTube API — prefer raw `UC…` ids, which skip resolution and can't silently fail.
- `tos` removes the specific comment(s) by YouTube comment id. There is no channel promotion — the
  removed entry is simply out.
- Only valid while the contest is **`snapshotted`**: scoring reads eligible rows, so a DQ here drops
  entries with no rescoring. Once scoring has begun, `reset --to snapshotted` first, then re-`dq`.
- It reports how many entries changed and warns about any handle/id that matched no eligible entry.

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
bun run worker cluster --contest <id> --store-vectors   # optional exact replay archive
```

Computes embeddings over keyword-stripped entry text, finds hard near-duplicates using the frozen
semantic + lexical thresholds, and stores each entry's cluster, nearest earlier match, similarity
scores, and originality penalty. The pass is all-or-nothing: failed embedding batches leave
`similarity_computed_at` null, and `advance` will refuse to run. Inspect the printed cluster report
before advancing.

### 5. Run the bracket ✅

```
bun run worker advance --contest <id>
```

Ranks entries by adjusted absolute score (raw mean total minus near-duplicate originality penalty),
takes the **top 64**, seeds them, stores a `bracket_fingerprint` for that seeded field, and runs the
single-elimination bracket (3 models × both orderings per matchup, majority vote, deadlock to the
higher seed) down to one winner. Materializes per-entry `raw_absolute_score`,
`originality_penalty`, `absolute_score` / `rank` / `seed` / `final_round` and the contest's
`winner_entry_id`, then sets status `complete`. Resume-safe only when the recomputed seeded field
matches the stored fingerprint; ~378 calls.

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
produced after it (in one locked transaction). It refuses to skip levels, so you cannot strand
downstream rows:

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

Publishing also reveals the keywords + salt into the contest config (read from the local
`secrets/<videoId>.json`, so that file must be present when you publish) — this is what lets anyone
re-derive the committed keyword hash, and it surfaces on `/rules`. `--unpublish` strips them again.

Still to build: export the full audit bundle for the public record —

- contest config (`panel`, prompt hashes/text, keyword hash, judge request settings);
- revealed keywords and salt;
- captured entries and disqualification reasons;
- per-model scores with usage/finish metadata;
- matchup decisions with usage/finish metadata;
- similarity config, clusters, nearest-earlier links, similarities, and originality penalties;
- bracket fingerprint and winner.

## Notes

- **Resume / crash recovery:** re-run the same command — finished work is skipped.
- **Keywords** are supplied per contest and never committed (a watch-gate, see rules.md
  §5).
- **Costs:** the absolute scoring pass dominates; the bracket is negligible (~378 calls).
- This runbook is kept in sync as each pipeline step lands — flip the 🚧/⬜ markers to ✅
  when a step becomes functional.
