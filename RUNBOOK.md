# Runbook — Running a Contest

Operational guide for running one contest end to end. For the contest rules see
[rules.md](rules.md); for the panel/models see [config.json](config.json); for the judge
prompts see [prompts/](prompts/).

**Status legend:** ✅ implemented · 🚧 stub (scaffolded, not yet functional) · ⬜ not built yet

## Prerequisites

- **Bun** installed; run `bun install` at the repo root.
- **Env vars** in the repo-root `.env` (auto-loaded):
  - `DATABASE_URL` — Postgres connection (Railway). ✅
  - `OPENROUTER_API_KEY` — scoring; needed by `score` and `advance`. 🚧
  - `YOUTUBE_API_KEY` — comment ingest; needed by `ingest`. ⬜
- **Database migrated:** `bun run db:migrate`. (Schema changes: the maintainer runs
  `db:generate` + `db:migrate` — do not run them automatically.)

## Where each step runs

- **`ingest` is time-sensitive** — it snapshots comments ~168h after the video is
  published, capturing text before later edits. It can run unattended as a **Railway cron
  service** (`worker ingest --due`, polled every ~10–15 min, idempotent via contest
  status). ⬜
- **`score` and `advance` run locally** — resume-safe batches you trigger by hand. The
  workload is LLM-bound, so running from a laptop against the Railway DB is fine.

## Run order

Run these in sequence for one contest. **Every command is resume-safe** — re-running picks
up where it left off (completed work is skipped via unique constraints).

### 1. Create the contest ⬜

Register the video id, snapshot time, keywords, and pinned config. _(Command TBD.)_

### 2. Snapshot the comments 🚧

```
bun run worker ingest --contest <id>     # snapshot one contest manually
bun run worker ingest --due              # cron mode: snapshot any contest past its cutoff
```

Fetches all top-level comments, validates each (length 50–1,000, all 3 keywords, no URLs,
one-per-channel, no affiliated accounts), and freezes them as `entry` rows. Run at or just
after the 168h cutoff.

### 3. Score the field 🚧

```
bun run worker score --contest <id>
```

Scores every eligible entry once per model (3 models), in isolation, storing per-model
rubric scores. ~10k × 3 calls — the bulk of the cost. Resume-safe via the unique
`(entry, model)` constraint.

### 4. Run the bracket 🚧

```
bun run worker advance --contest <id>
```

Ranks entries by absolute score, takes the **top 64**, seeds them, and runs the
single-elimination bracket (3 models × both orderings per matchup) down to one winner.
~378 calls.

### 5. Publish results ⬜

Export entries, per-model scores, and matchup decisions for the public record; surface them
in the web UI.

## Notes

- **Resume / crash recovery:** re-run the same command — finished work is skipped.
- **Keywords** are supplied per contest and never committed (a watch-gate, see rules.md
  §5).
- **Costs:** the absolute scoring pass dominates; the bracket is negligible (~378 calls).
- This runbook is kept in sync as each pipeline step lands — flip the 🚧/⬜ markers to ✅
  when a step becomes functional.
