# Context Compression customer pilot

## Offer

A short, no-charge benchmark of `/api/v1/compress` on one real agent workflow.
The purpose is to decide whether deterministic, source-linked passage selection
improves that workflow under a caller-set context budget. The pilot is not a
generic compression-ratio demonstration and makes no latency or answer-quality
promise before measurement.

The customer can use a starter API key with 20,000 credits. If the workflow
earns a production place, the current self-service plans are Builder at
$20/month and Scale at $100/month.

## Good pilot workload

- Repeated retrieval or tool output creates context larger than the downstream
  model actually needs.
- The customer can provide 10–20 representative, sanitized traces.
- Each trace has a real task and a small set of exact source passages that a
  good context pack must retain.
- The existing baseline can be rerun: raw context, truncation, or the
  customer’s current chunking/reranking method.

Do not use production secrets, regulated records, or personal data in the
pilot unless the customer has completed its own security and legal review.

## Acceptance criteria agreed before testing

1. Exact required-source retention rate across labeled traces.
2. BPE input and compiled output token counts using the customer’s actual
   downstream tokenizer.
3. Downstream answer or task result against the customer’s own rubric.
4. Compiler p50/p95 compute latency and separately measured API end-to-end
   p50/p95 latency.
5. Total cost per successful task against the existing baseline, including the
   Maha fee and downstream model spend.
6. Documented failures: missing evidence, unacceptable latency, malformed
   inputs, or downstream regressions.

Reduction is controlled partly by `tokenBudget`; it is not evidence of quality
on its own. “Retained” means an exact labeled span survives in the compiled
pack. It does not establish factual truth or downstream model correctness.

## Pilot sequence

1. Agree one workflow, owner, baseline, rubric, and stop conditions.
2. Customer sanitizes and labels 10–20 representative traces.
3. Run the repository measurement harness with `--corpus` and preserve its JSON
   output as private pilot evidence.
4. Run the same traces through the deployed API to measure end-to-end behavior.
5. Review retained/omitted passages and downstream results together.
6. Continue only if the pre-agreed thresholds pass; otherwise document why and
   end the pilot without a sales claim.

Local measurement command:

```bash
node --experimental-strip-types scripts/measure-compression.ts \
  --corpus <sanitized-labelled-corpus-directory> \
  --json
```

The built-in corpus is synthetic and must not be quoted externally.
