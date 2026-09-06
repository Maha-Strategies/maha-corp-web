# Hawthorn `GovernedTraceReceipt v0.1`

Status: offline, read-only integration profile. It does not deploy into Hawthorn's runtime, write to SkillLoop, transmit private data, or authorize an action.

## Purpose

Hawthorn's `src/trace_export.py` is the execution-truth boundary: it emits a SkillLoop-compatible trace with runtime and adapter identity, actor metadata, retrieval-context hash, events, and normalized/raw trace hashes. Maha's profile maps that completed trace into four separately inspectable governance layers without retaining source contents.

| Maha layer | Receipt fields | Boundary |
| --- | --- | --- |
| Evidence | ordered source-record IDs and SHA-256 digests | IDs and digests only; no source text |
| Context | selected-context digest, retrieval-policy digest, token limit/selection and whether the budget held | records what was selected and under which policy without reproducing passages |
| Authority | actor, organization, role and visibility scope | identifies whose authority governed the trace |
| Receipt | guardrail, compaction and escalation outcomes; checkpoint/parent lineage; completion time | records governance outcomes and execution lineage |

The profile preserves Hawthorn's `normalized_trace_sha256` and `raw_trace_sha256` as trace bindings. The receipt digest is SHA-256 over deterministic canonical JSON with `receiptDigest` and `proof` omitted. An optional signer receives those exact canonical bytes. A signed receipt fails closed unless the caller supplies an explicit signature verifier.

## Files

- Schema: `/schemas/governed-trace-receipt-0.1.0.json`
- Adapter, builder and verifier: `lib/integrations/hawthorn-governed-trace-receipt.ts`
- Synthetic non-private upstream trace: `fixtures/hawthorn-governed-trace-receipt/synthetic-skillloop-trace.json`
- Synthetic governance annotations and deterministic output: `fixtures/hawthorn-governed-trace-receipt/synthetic-governance-input.json` and `synthetic-governed-trace-receipt.json`
- Determinism, signature-interface and tamper tests: `test/hawthorn-governed-trace-receipt.test.ts`

## Deliberate limits

- `v0.1` does not claim that a source digest proves source truth.
- It does not reconstruct source contents or the passages in Hawthorn's exported `retrieved_context`.
- Governance annotations are supplied at the integration boundary because Hawthorn's current trace export does not contain source ordering, retrieval-policy identity, organization/visibility authority, or explicit guardrail/compaction/escalation outcomes.
- The receipt is not a permission grant, settlement receipt, or proof that a downstream action was safe.
- JSON Schema checks shape. The verifier additionally enforces contiguous source order, unique record IDs, context-budget consistency, lineage presence, digest integrity, and signature fail-closed behavior.

## Verification

```bash
node --experimental-strip-types scripts/generate-hawthorn-governed-trace-receipt.ts
node --test --experimental-strip-types test/hawthorn-governed-trace-receipt.test.ts
```

The test suite changes source order and digests, context and policy digests, authority, each governance outcome, lineage, and the receipt digest. Every mutation must be rejected.
