# MCRB-1 dense retriever baseline — methodology

**Release:** `1.1.0-dense` · **Additive to:** MCRB-1 v1.0.0, which is unchanged.

## Why this exists

MCRB-1 v1.0.0 compares the Maha Context Compiler against front truncation, tail
recency, seeded random, and an unattainable oracle. Every one of those baselines
is naive. A reader entitled to be sceptical would ask the obvious question —
*how does it do against actual retrieval?* — and v1 could not answer it.

This release answers it, on the same 250 cases, under the same budget, scored by
the same function.

## What the run found

The dense retriever beats the production Maha scorer on Maha's own primary
metric.

| Method | Complete evidence set | Wilson 95% | Any-evidence hit | Mean recall |
| --- | ---: | :---: | ---: | ---: |
| `oracle_ceiling` *(unattainable)* | 99.6% | 97.8-99.9 | 99.6% | 99.6% |
| **`dense_bge_small_en_v15`** | **71.2%** | **65.3-76.5** | **82.0%** | **76.6%** |
| `maha_bm25` *(production)* | 60.4% | 54.2-66.3 | 72.0% | 66.2% |
| `maha_keyword` | 54.0% | 47.8-60.1 | 64.0% | 58.8% |
| `front_truncation` | 25.6% | 20.6-31.4 | 30.4% | 27.9% |
| `seeded_random` | 21.6% | 16.9-27.1 | 33.2% | 26.9% |
| `tail_recency` | 20.4% | 15.9-25.8 | 25.2% | 22.7% |

A 10.8-point gap on complete-evidence-set retention, and 10.4 points on
any-evidence hit rate. **The Wilson intervals overlap** in the range 65.3-66.3,
so this is a clear directional result on 250 cases rather than a statistically
separated one; a larger cohort would be needed to tighten it.

Nothing was tuned in response. The model, prefix, pooling, chunking and
tie-break were fixed before the first full run, and this section was written
after it. That ordering is the point of publishing the baseline at all: a
benchmark that only ever compared against front truncation and shuffled
passages was not answering the question a technical buyer actually asks.

### What this does and does not change

- It **does** mean the claim "Maha beats naive baselines on evidence retention"
  is true but incomplete, and should not be presented as though naive baselines
  were the relevant comparison.
- It **does not** mean the Context Compiler should be replaced by an embedder.
  The two produce different artifacts: the compiler runs deterministically with
  no model, no GPU and no warm cache, returns source-linked provenance and
  hashes, and completed each case in 3.48 ms at p50. The dense path needed
  798 seconds of embedding wall-clock across the cohort before any ranking
  happened, and needs a model, its weights and a runtime.
- It **does** suggest the strongest version of the product is probably not
  BM25 alone. A hybrid that uses dense ranking where it helps and keeps the
  compiler's determinism, provenance and cost profile is the obvious next
  experiment. This release does not run it.

Retention is one axis. Cost, latency, determinism, provenance and operational
footprint are others, and this benchmark measures exactly one of them.

## What the baseline does

1. Build the cohort with the frozen v1 harness: the same pinned QASPER dev
   split, the same eligibility rules, the same chunking, the same 250 cases in
   the same order.
2. Embed the question with `BAAI/bge-small-en-v1.5`, using the query prefix that
   model was trained with, and embed each candidate passage bare.
3. Rank passages by cosine similarity over L2-normalised CLS embeddings, ties
   broken by original passage index so the ordering is total.
4. Pack the highest-ranked passages using the **unchanged** v1 packer and the
   **unchanged** selection allowance.
5. Score with the **unchanged** v1 exact-span scorer.

Only step 3 is new. Steps 1, 4 and 5 are shared code, not a reimplementation:
`lib/benchmarks/mcrb1-harness.ts` was extracted verbatim from the v1 runner and
both runners now import it.

**This is retrieval only.** There is no generative compressor, no summariser and
no reconstruction step.

## What it does not show

- **It is not a like-for-like comparison of systems.** The corpus, the budget,
  the packer and the scorer are identical. The approaches are not: one is
  retrieval over pre-chunked passages, the other is context compilation. A
  difference in the primary metric is a difference between those two things on
  this corpus, not a general statement that one technique beats the other.
- **One model, one revision.** `bge-small-en-v1.5` at commit `5c38ec7c` is a
  33M-parameter English model. A larger embedder, a reranker, or a hybrid
  sparse-dense pipeline would each be a different result. None is claimed here.
- **Truncation at 512 model tokens.** Passages longer than the embedder's window
  are truncated *for scoring only*; the packer still sees and packs the whole
  passage. A long passage whose relevant content sits past token 512 can
  therefore be ranked on its opening alone. This is a real property of the
  baseline, not an implementation defect, and it is disclosed rather than
  engineered around.
- **Exact-span containment penalises paraphrase**, equally for every method. It
  is not generated-answer accuracy.
- **No tuning after inspection.** The model, the prefix, the pooling, the
  chunking and the tie-break were fixed before the first full run and were not
  revised afterwards. The protocol block records this as
  `tuningAfterInspection: "none"`.

## Fairness, stated plainly

| Held identical | Deliberately different |
| --- | --- |
| Corpus, cohort, and case order | Ranking signal: cosine similarity vs BM25 |
| Chunking and passage identifiers | Query representation: dense vector vs term statistics |
| Declared budget and selection allowance | What the method is: retrieval vs compilation |
| Packer (`fit`) and renderer | |
| Scorer (`evaluate`), exact-span containment | |
| Wilson 95% intervals | |

The dense baseline is given every structural advantage the other extractive
methods get, including the same citation traceability by construction. What it
is not given is a different budget or a different scorer.

## Reproducing

```bash
npm run benchmark:mcrb1-dense
```

Offline, against an already-extracted corpus and a warm model cache:

```bash
MCRB_QASPER_DEV_JSON=/abs/path/qasper-dev-v0.3.json \
HF_HUB_OFFLINE=1 \
  npm run benchmark:mcrb1-dense
```

The runner refuses to publish unless the cohort it rebuilds matches the frozen
v1 `cohort.json` on every question ID, paper ID, input hash, evidence-set hash,
token count and position bucket. A cherry-picked or drifted subset fails rather
than producing a plausible-looking number.

Model weights and embedding caches are **not committed**. The model is public,
free and needs no credential; its identity is pinned by name and commit
revision, and the run records a digest over all similarity scores so two runs
can be compared without republishing the vectors.

## Determinism

Single-threaded inference, fixed seed, inference mode, L2-normalised CLS
pooling, and an index tie-break. Thread count is settable via
`MCRB_DENSE_THREADS` but defaults to 1: multi-threaded CPU reduction changes
floating-point summation order, which can flip a tie and move a published
number. The default is slower and reproducible; that is the correct trade for a
benchmark.

## Artifacts

- `benchmarks/mcrb-1/dense/results.json` — aggregate, side-by-side comparison,
  failure classes, model provenance, environment.
- `benchmarks/mcrb-1/dense/cases.jsonl` — one row per case.
- `benchmarks/mcrb-1/dense/manifest.json` — corpus digest, result digests,
  model provenance, environment, runner command.
- Public mirrors under `public/benchmarks/mcrb-1/dense/`.

MCRB-1 v1.0.0 artifacts are untouched.
