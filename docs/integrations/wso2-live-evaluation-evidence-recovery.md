# WSO2 live evaluation — evidence recovery and verification

**Version:** 1.0.0 · **Recovered:** 2026-08-21 · **Run recovered:** `wso2-large-live-20260817-v1`
**Outcome:** the primary evidence was **recovered and digest-confirmed** long enough to generate the committed, per-workload artifact. The answer-bearing primary files were stored in volatile `/private/tmp` and are no longer locally available; every public figure remains derived from the committed rows, while full source-to-artifact regeneration now requires reacquiring the digest-identified primary files from controlled storage.

## Why this document exists

The public WSO2 page carried a 60-call aggregate — 98.84% fewer provider input
tokens, 98.20% lower model cost, 60 of 60 required facts retained — as literal
strings inside a React component. The underlying run artifacts are excluded by
`.gitignore` (`/artifacts/wso2/`), and a prior survey concluded the checkpoint
was absent from the machine. A headline that cannot be checked against anything
is not evidence, whatever its provenance, so the aggregate could not be defended
to a technical buyer who asked to see the run.

## What was searched

Read-only. No external account, cloud storage, mailbox, CI retention, Vercel
project or provider console was accessed; those would need separate
authorization.

| Location | Result |
| --- | --- |
| Tracked files on `origin/main` | No checkpoint, adjudication or aggregate `evaluation.json` has ever been tracked |
| Full history, all refs (`git log --all --diff-filter=A`) | No path matching `checkpoint`, `adjudicat`, `artifacts/wso2` or `evaluation.json` was ever added |
| Every reachable blob, searched for the published figures | The aggregates appear in exactly one file across all history: `app/integrations/wso2/page.tsx` |
| Stashes | None (0 entries) |
| Reflog (465 entries), unreachable and dangling objects (615) | Nothing evaluation-related |
| **36 linked worktrees**, including four WSO2-specific ones under `/private/tmp` | **Primary evidence found and digest-confirmed during recovery.** The volatile source files are no longer present locally; their recorded digests remain the identity check for any reacquired copy. |
| Ignored `artifacts/wso2/` directories inside worktrees | `/private/tmp/maha-wso2-one-command-evaluation/artifacts/wso2/reproduction/` — inspected and **rejected** as a source: `mode: dry-run`, mock provider, 739,720 baseline input tokens rather than the live 1,621,553 |

The earlier "absent from this machine" finding was a search-scope error: the
prior sweep covered `/Users/mayonerajan` to a bounded depth and never reached
`/private/tmp`, where the run's worktree wrote its artifacts.

## What was recovered

| File | SHA-256 | Bytes | Contains all 20 workloads | Forbidden content |
| --- | --- | ---: | --- | --- |
| `wso2-large-live-20260817-v1-checkpoint.json` | `40cb6956b0b732918c1bf6d63852d1076505c0348dd195a86384a5a935f4d0f3` | 142,128 | **Yes** — 60 records, 20 workloads × 3 paths, all `outcome: ok` | **Yes** — `reviewText` (model answer) on every record |
| `wso2-large-live-20260817-v1-adjudicated.json` | `a77a0e01f86fa1130159e29deb5a6a66eff8e2ea65c41f96404bb02c477dc68d` | 103,901 | Yes — 60 blinded responses | **Yes** — `answer` text on every response |
| `wso2-large-live-20260817-v1-adjudication-key.json` | `8e1aede6db5bb1264c7a8f094fea5adfeec56413a9fcee4fb4137c994bd40cd4` | 9,371 | Yes — 60 response-to-path mappings | No |
| `wso2-large-live-20260817-v1-adjudication-blinded.json` | `f76d5f21e3c1c95fe81b558951c9a561b6b437fd2d19a48b5aca76411b645e25` | 88,927 | Yes | Yes — pre-adjudication answers |

The first two digests **match exactly** the `checkpointSha256` and
`adjudicationSha256` already recorded in the committed
`content/integrations/wso2-sanitized-three-path-trace.json`. The recovered files
are therefore provably the same bytes the published trace was built from, not a
lookalike.

Neither file contains a credential, an interceptor secret, a source document, a
compiled context pack or a provider request body. The only forbidden class
present is model answer text, which is why the primary files stay uncommitted.

## What the primary evidence proves

Recomputed mechanically from the checkpoint, and from the blinded adjudication
joined to paths through its key:

| Path | Input tokens | Cost | Deterministic facts | Adjudicated facts | Citations | p50 latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| WSO2 baseline | 1,621,553 | $1.632963 | 15 / 60 | 60 / 60 | 60 / 60 | 2,867 ms |
| WSO2 Prompt Compressor | 1,489,323 | $1.505248 | 0 / 60 | 0 / 60 | 60 / 60 | 6,958 ms |
| WSO2 + Maha | 18,849 | $0.029379 | 24 / 60 | 60 / 60 | 60 / 60 | 1,701 ms |

Token reduction **98.84%**, cost reduction **98.20%**, 60/60 calls succeeded
with zero retries. The published token, cost and percentage figures reproduce
**exactly**.

### The one thing the page got wrong

The page showed "60 / 60 required facts retained" without saying which scorer
produced it. There are two, and they disagree:

- **Deterministic** — exact evidence-span containment. Reproducible by anyone
  with the corpus. Reports **24 / 60** for Maha and **15 / 60** for the
  baseline, because a semantically correct paraphrase scores as a miss.
- **Path-blinded adjudication** — a semantic rubric applied to the same answers
  with the path hidden from the reviewer. Reports **60 / 60** for Maha and the
  baseline, **0 / 60** for the Prompt Compressor.

The published 60/60 is the adjudicated score and is defensible — but a reviewer
who recomputed from the checkpoint alone would have got 24/60 and concluded the
page was inflated. Both scores are now published per workload, and the page
names which one the table shows.

## What is now committed

- `content/integrations/wso2-live-evaluation-evidence.json` — the sanitized
  artifact: 20 workloads, 60 rows, per-row tokens, cost, latency, bypass
  decision, both fact scores, citation resolution, prohibited-assertion count
  and context strategy; aggregates and the headline comparison derived
  mechanically from those rows.
- `lib/integrations/wso2-live-evidence.ts` — parser and validator. It
  re-derives every aggregate from the rows and **throws** if a stored total
  disagrees, rejects unsupported path labels, missing or duplicated workloads,
  a workload missing a path, an impossible fact score, and any forbidden field
  at any depth.
- `scripts/generate-wso2-live-evidence-artifact.ts` — the only supported way to
  produce the artifact. Makes no provider call.
- `scripts/validate-wso2-live-evidence.ts` — the reviewer's command.

## Verify it yourself

```bash
shasum -a 256 content/integrations/wso2-live-evaluation-evidence.json
npm run validate:wso2-live-evidence
npm run reproduce:wso2-evaluation
```

The first prints the artifact digest, which is also printed on the public page.
The second re-derives all aggregates from the rows and fails on any
inconsistency. The third is the frozen-corpus dry run: it contacts nothing and
makes no provider call.

A holder of the primary files can confirm the artifact is exactly what they
produce:

```bash
npm run generate:wso2-live-evidence -- \
  --checkpoint=/path/to/wso2-large-live-20260817-v1-checkpoint.json \
  --adjudication=/path/to/wso2-large-live-20260817-v1-adjudicated.json \
  --adjudication-key=/path/to/wso2-large-live-20260817-v1-adjudication-key.json \
  --check
```

## Retention of the primary evidence

The three source files were recovered from volatile `/private/tmp` during this
work, but are **not currently present locally**. They must not be committed:
they carry model answer text for all 60 calls. If a retained copy is available,
move it to durable, access-controlled storage outside the repository and verify
its SHA-256 digests against the values recorded here before using it. If no copy
is retained, a new, explicitly authorized live run is the only way to recreate
source-to-artifact regeneration evidence.

The committed artifact remains useful: it exposes all 60 answer-free rows and
mechanically re-derives every displayed aggregate. What it cannot independently
establish without the primary files is that each derived row was extracted from
the original answer-bearing checkpoint.

## Boundaries

- The corpus is synthetic. This run does not establish performance on a WSO2
  customer workload, and the pilot exists to test whether it survives one.
- One execution, 2026-08-17. Latency is a single observation per call.
- The Prompt Compressor result is specific to WSO2 AI Gateway 1.1.0, Prompt
  Compressor 0.9.0 and a 0.55 retained ratio.
- Cost applies the declared pricing assumption to observed token counts. It is
  not a provider invoice.
- No provider call, deployment, publication or external write was made by the
  recovery work.
