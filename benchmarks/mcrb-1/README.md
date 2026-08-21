# Maha Context Retention Benchmark v1 (MCRB-1)

MCRB-1 measures how often a fixed-budget extractive context selector preserves independently annotated supporting evidence from long scientific papers.

It is deliberately narrower than an answer-generation benchmark. A retained evidence span means the selected context contains the exact human-highlighted source text. It does not establish that a downstream model will answer correctly, interpret the evidence correctly, or avoid hallucination.

## Dataset

- **Dataset:** QASPER v0.3.0 development split
- **License:** CC BY 4.0
- **Authors:** Pradeep Dasigi, Kyle Lo, Iz Beltagy, Arman Cohan, Noah A. Smith, and Matt Gardner
- **Source:** <https://allenai.org/data/qasper>
- **Paper:** <https://aclanthology.org/2021.naacl-main.365/>
- **Pinned archive SHA-256:** `a28fdf966db827bcee3d873107d6b6669864fb7ca8fbf73a192f5e39191bdb5a`

The benchmark deterministically selects the first 250 eligible, answerable development questions ordered by `SHA-256(question_id)`. Each case must have at least one exact highlighted-evidence set, contain at least 4,096 BPE tokens, and fit the production standard request limit. The checked-in `cohort.json` records every question ID, paper ID, input hash, evidence-set hashes, token count, and evidence-position bucket.

## Fixed protocol

- Declared context budget: 2,048 tokens
- Measurement tokenizer: `gpt-tokenizer` `encode()`
- Maha configuration: BM25 scoring, compact provenance, guaranteed budget
- Primary metric: percentage of cases where at least one complete human annotation set survives selection
- Secondary metrics: any-evidence hit rate, mean evidence recall, token reduction, output tokens, citation traceability, and local algorithmic latency
- Confidence intervals: Wilson 95% intervals for binary rates

All extractive methods receive the same internal selection allowance used by Maha's guaranteed-budget mode. Every method returns stable passage identifiers, so citation traceability is 100% by construction.

## Methods

1. `maha_bm25`: the production Maha Context Compiler scorer.
2. `maha_keyword`: Maha's earlier unweighted keyword scorer.
3. `front_truncation`: passages in document order until the budget is full.
4. `tail_recency`: passages in reverse document order until the budget is full.
5. `seeded_random`: deterministic random passage ordering keyed by question ID.
6. `oracle_ceiling`: known gold-evidence passages first. This is an unattainable ceiling, not a competitor.

Generative LLM and LangChain summarization are not assigned an evidence-retention score in v1. Exact-span containment systematically penalizes legitimate paraphrase, while an LLM judge would make the primary result model-dependent. They require a separate, frozen answer-quality protocol with provider, prompt, model-version, repetition, and citation-scoring controls.

## Reproduce

```bash
npm run benchmark:context-retention
```

The runner downloads the pinned 10.8 MB archive into the operating system's temporary directory, verifies its SHA-256 digest, and prints the aggregate result. To regenerate the checked-in publication artifacts:

```bash
npm run benchmark:context-retention:publish
```

For an offline run, point to an already extracted development JSON file:

```bash
MCRB_QASPER_DEV_JSON=/absolute/path/qasper-dev-v0.3.json \
  npm run benchmark:context-retention
```

## Artifacts

- `results.json`: aggregate metrics, protocol, economics, and limitations.
- `cohort.json`: immutable case manifest without source document text.
- `cases.jsonl`: all 1,500 case-method measurements.

## Limitations

QASPER represents NLP research papers, not every enterprise or agent workload. The benchmark measures extractive evidence survival, not generated-answer quality or factuality. Local latency is useful only for relative algorithmic comparison. Input-cost estimates use a declared reference price and exclude output generation equally across methods.

## Additive release: dense retriever baseline (1.1.0-dense)

v1.0.0 above is frozen and unchanged. A separate additive release adds a
seventh method, `dense_bge_small_en_v15` — an embedding retrieval baseline
using `BAAI/bge-small-en-v1.5`, evaluated on the same 250 cases under the same
budget, packer and scorer.

**It scores 71.2% complete-evidence-set retention against `maha_bm25`'s 60.4%.**
The Wilson intervals overlap at 65.3-66.3, so the result is directional rather
than statistically separated.

- Artifacts: `benchmarks/mcrb-1/dense/`
- Methodology and fairness limits: `docs/benchmarks/mcrb1-dense-retriever-baseline.md`
- Run it: `npm run benchmark:mcrb1-dense`
