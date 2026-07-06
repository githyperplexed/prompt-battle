# Verification Guide

How to independently verify a contest result, end to end. Written for both humans and
agents; no trust in the operator is required beyond what is stated in
[Limits](#limits--what-is-not-promised).

For the game itself see [rules.md](rules.md); for running a contest see
[RUNBOOK.md](RUNBOOK.md). The public site summarizes this process on `/rules`.

---

## The model in one paragraph

**What:** before any entry is judged, every input that can decide the winner — the judge
panel, the exact judge prompt text, the judge request settings, the similarity (anti-clone)
configuration, and the hidden keywords — is frozen into the contest record, most of it as
SHA-256 commitments. After the contest, the full decision log is published: every captured
comment, every disqualification reason, every per-model rubric score, every bracket vote, and
the revealed keywords + salt.

**Why:** with the inputs committed _before_ judging and the decisions recorded _during_ it,
anyone can confirm the two ends meet in the middle — that the published winner follows
mechanically from the published rules and the frozen inputs, with nothing swapped, re-scored,
tuned, or hand-picked after the entries were seen.

## What is committed, and when

| Artifact                                       | Committed at | Form                       | Revealed                                  |
| ---------------------------------------------- | ------------ | -------------------------- | ----------------------------------------- |
| Judge panel (3 models, 3 providers)            | `create`     | stored in plain text       | immediately                               |
| Judge prompt templates (score + compare)       | `create`     | full text + SHA-256 hash   | immediately (hashes); text is in the repo |
| Judge request settings                         | `create`     | stored in plain text       | immediately                               |
| Similarity config (model, thresholds, penalty) | `create`     | full config + SHA-256 hash | immediately                               |
| Hidden keywords + salt                         | `create`     | SHA-256 commitment only    | at `publish`                              |
| Captured field (entries + DQ reasons)          | `ingest`     | database rows              | leaderboard phase onward                  |
| Per-model scores + audit metadata              | `score`      | database rows              | with the results                          |
| Cluster / originality-penalty record           | `cluster`    | database rows              | with the results                          |
| Seeded-field fingerprint                       | `advance`    | SHA-256 fingerprint        | with the results                          |
| Matchup votes (per model, per ordering)        | `advance`    | database rows              | with the results                          |

The contest config is **versioned and self-validating**: the worker re-derives every stored
hash from the stored content on every parse and fails closed on any mismatch
([contest-config.ts](worker/src/utilities/contest-config.ts)). There is no way to edit a
pinned prompt or panel in place — changing them requires deleting the contest
(RUNBOOK.md, "Resets & deletion").

---

## Check 1 — The judges and their instructions

**Check:** hash the two prompt templates and compare to the committed hashes shown on
`/rules` (and in the contest config).

The template files are [prompts/judge-score.md](prompts/judge-score.md) and
[prompts/judge-compare.md](prompts/judge-compare.md). The hashed content is not the raw file:
the loader ([prompts.ts](worker/src/services/prompts.ts)) first normalizes CRLF to LF and
strips HTML comments (`<!-- … -->`), then takes the trimmed text after `## System message`
(up to `## User message`) as the system section and the trimmed text after `## User message`
as the user section. The hash is:

```
sha256( system + "\0" + user )   → hex
```

([contest-config.ts](worker/src/utilities/contest-config.ts), `promptContentHash`.)

**Proves:** every entry was judged by the published three-provider panel using exactly the
published instructions — the prompts were not rewritten after the entries were visible, or
the commitment would no longer match.

## Check 2 — The hidden keywords

**Check:** once results are published, the plaintext keywords and salt appear on `/rules`.
Re-derive the commitment and compare to the committed keyword hash:

```
normalized = keywords, each trimmed and lowercased, sorted, joined with "|"
sha256( salt + ":" + normalized )   → hex
```

([keywords.ts](worker/src/utilities/keywords.ts), `keywordHash`.)

**Proves:** the three keywords were fixed before judging (the hash was committed at contest
creation, before a single comment was captured) — they were not chosen after the fact to
qualify or disqualify particular entries. The worker enforces this in both directions: ingest
and cluster refuse to run if the local keyword secret no longer matches the commitment, and
publish refuses to reveal keywords that do not re-derive it.

## Check 3 — Eligibility of the captured field

**Check:** the published record contains every captured comment with its snapshot text,
channel id, YouTube timestamps, and — for disqualified entries — the reason. Re-apply the
mechanical rules from [rules.md](rules.md) §3 to any entry and confirm its status:

- 50–3,000 characters inclusive, counted in Unicode code points.
- All three keywords present: case-insensitive, whole-word (not adjacent to another letter
  or digit), any order.
- No URLs.
- One entry per channel — the earliest eligible comment counts; later ones are
  `duplicate_channel`.
- Published/edited at or before the snapshot cutoff (`posted_after_cutoff` comments are not
  entries; `edited_after_cutoff` entries are disqualified because the cutoff text cannot be
  recovered).
- At most the first 10,000 eligible entries count; later ones are archived as `over_cap`.

Two reasons are judgment calls rather than recomputable: `tos` (content moderation, plus any
operator-issued removals — these carry a stored `dq_note` justification) and `affiliated`
(owner/moderator accounts). The reference implementation for everything mechanical is
[validation.ts](worker/src/utilities/validation.ts) and
[snapshot.ts](worker/src/utilities/snapshot.ts), which are unit-tested in `worker/test/`.

**Proves:** no eligible entry was quietly dropped and no ineligible entry was let in.

## Check 4 — Scores, ranking, and the top-64 cut

**Check:** from the published per-model scores, recompute each entry's placement:

```
total          = persuasiveness + originality + cleverness + execution   (each 0–25)
raw score      = mean of the 3 model totals, rounded to one decimal
adjusted score = raw score − originality penalty                          (exact, no re-round)
```

Rank by adjusted score descending, breaking ties in order by: higher minimum single-model
total → lower variance across the three totals → earlier snapshot timestamp → entry id.
The top 64 advance and are seeded in rank order.
([ranking.ts](worker/src/utilities/ranking.ts).)

Then recompute the fingerprint of the seeded field and compare to the published one:

```
sha256( JSON.stringify( [ { id, rank, seed, absoluteScore }, … ] ) )   → hex
```

— an array over the seeded entries in rank order, with exactly those keys in that order.
([bracket.ts](worker/src/utilities/bracket.ts), `bracketFingerprint`.)

**Proves:** the ranking, the cut, and the seeding follow mechanically from the recorded
scores. The fingerprint is also what the engine itself uses to refuse resuming a bracket
against any other field.

## Check 5 — The near-duplicate (originality) penalties

**Check:** the similarity configuration — embedding model, preprocessing version, thresholds,
and penalty formula — is committed at creation as a hash over its canonical JSON (sorted
keys, `hash` field excluded; [contest-config.ts](worker/src/utilities/contest-config.ts),
`similarityContentHash`). The published record includes each entry's cluster id, nearest
earlier match, similarity scores, and penalty.

The mechanics ([similarity.ts](worker/src/utilities/similarity.ts)): entry text is
keyword-stripped and normalized, embedded with the pinned model, and a pair is a **hard
near-duplicate** only if it clears _both_ the cosine and lexical thresholds. Duplicates
cluster together; within a cluster the earliest entry (by snapshot timestamp, then id) keeps
full originality credit, and each later member loses originality credit up to the configured
`hardPoints`, capped at its own mean originality score — the penalty subtracted in Check 4.

Because embeddings come from a hosted model, exact replay of the vectors is only possible
when the contest was run with `--store-vectors` (the archived vectors are then part of the
record). Without them, verify that the _recorded_ similarities imply the recorded penalties
under the committed thresholds and formula.

**Proves:** originality penalties were applied by the pre-committed mechanical rule — not
invented per entry — and the original author of a duplicated idea kept full credit.

## Check 6 — The bracket

**Check:** replay the bracket from the seeds and the recorded votes:

- Bracket size = the smallest power of two ≥ the entrant count; missing slots are
  first-round byes that auto-advance the present seed (a field of N entrants plays exactly
  N − 1 matchups).
- Pairings follow the standard seed layout (1 vs the lowest seed, and so on — seeds #1 and
  #2 can only meet in the final; [bracket.ts](worker/src/utilities/bracket.ts), `seedOrder`).
- Each matchup shows six recorded comparisons: 3 models × both orderings (A-first and
  B-first, to cancel position bias). A model's vote **counts only if it chose the same entry
  in both orderings**; otherwise it abstains. Majority of counting votes wins; a deadlock
  (including all-abstain) goes to the higher seed. (`tallyMatchup`, same file.)

Recount any matchup — or all 63 — down to the champion.

**Proves:** the winner follows from the recorded votes alone; no matchup outcome was
overridden.

---

## Limits — what is _not_ promised

- **No exact re-inference.** The judges are hosted models addressed by slug, and providers
  can change what a slug serves. Re-running the prompts is not promised to reproduce the
  recorded scores. What verification establishes is that the _recorded_ decisions, under the
  _committed_ inputs and published rules, produce the published result. The per-call audit
  metadata (finish reason, token usage, provider metadata, and the model's pre-clamp output)
  is recorded to make anomalies visible.
- **Moderation and affiliation are judgment calls.** They are disclosed (with operator notes
  where manual), but they are not mechanically recomputable the way length or keywords are.
- **The commitments live in the contest database record** and surface on `/rules`. Until the
  full audit-bundle export ships (see RUNBOOK.md, "Still to build"), the public site is the
  interface to the published record.

## Quick reference — where things live

| What                              | Where                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules (the contract)              | [rules.md](rules.md)                                                                                                                                                             |
| Committed hashes + reveal         | `/rules` on the contest site                                                                                                                                                     |
| Prompt templates                  | [prompts/](prompts/)                                                                                                                                                             |
| Default panel                     | [config.json](config.json)                                                                                                                                                       |
| Hashing / fingerprint code        | [worker/src/utilities/keywords.ts](worker/src/utilities/keywords.ts), [contest-config.ts](worker/src/utilities/contest-config.ts), [bracket.ts](worker/src/utilities/bracket.ts) |
| Ranking / tally / similarity code | [worker/src/utilities/ranking.ts](worker/src/utilities/ranking.ts), [bracket.ts](worker/src/utilities/bracket.ts), [similarity.ts](worker/src/utilities/similarity.ts)           |
| Unit tests pinning the mechanics  | [worker/test/](worker/test/)                                                                                                                                                     |
