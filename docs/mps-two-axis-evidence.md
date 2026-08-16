# Two-axis claim evidence

Status: implemented in the knowledge layers; **not** yet a change to the published MPS specification.

## The problem

Every evidence vocabulary in this repository was single-axis, and each knowledge
layer invented its own:

| Where | Vocabulary |
| --- | --- |
| `lib/mps-audit-engine.ts` | `VERIFIED, SOURCED, BOUNDARY, ILLUSTRATIVE, UNVERIFIED` — published as MPS/0.1, archived at `10.5281/zenodo.21241308` |
| `scripts/expand-graph.ts` | the same minus `BOUNDARY` |
| `lib/knowledge-data.ts` | `source-supported, method-basis, bounded-inference, open-question` |
| `lib/astronomy-knowledge.ts` | `direct-observation, calibrated-measurement, method-basis, model-dependent, consensus-summary, open-question` |

A single axis has to answer two different questions at once:

1. **Provenance** — are we representing the cited sources accurately?
2. **Empirical support** — what actually supports the proposition itself?

These are independent, and conflating them produces claims that read as stronger
than they are. The clearest case in this corpus was `ppg-003`, which cited a Dow
product-marketing page. It was tagged `source-supported` — accurate as to
sourcing, misleading as to evidence — and the gap survived only as free-text
`boundary` prose that no consumer could query.

## The model

`lib/claim-evidence.ts` defines both axes.

**Provenance** — `restates-source`, `combines-sources`, `maha-inference`.

**Empirical** — `direct-observation`, `calibrated-measurement`, `established`,
`consensus-summary`, `method-basis`, `model-dependent`, `bounded-inference`,
`interested-party`, `open-question`.

The empirical axis is the union of what the layers need. Astronomy's states are
bound to it with `satisfies readonly ClaimEmpiricalStatus[]`, so a layer that
drifts back to a private vocabulary fails to compile rather than failing review.

`requiresBoundary()` makes the boundary note mandatory wherever the pair is not
self-explanatory, and the layer integrity checks enforce it.

## Relationship to MPS/0.1

`toMpsTag()` derives an MPS/0.1 tag from the pair. MPS/0.1 is a published,
DOI-archived specification, so this layer derives from it rather than redefining
it.

The mapping is deliberately lossy, and the loss is the point. A claim that is
well-sourced and empirically established and a claim that is well-sourced and
merely vendor-asserted both map onto `SOURCED`, because MPS/0.1 has nowhere to
put the difference. `test/claim-evidence.test.ts` asserts this collapse
explicitly so it stays visible.

## Why this matters beyond semiconductors

The astrology tradition layer is the sharpest version of the same problem. An
interpretation rule quoted precisely from Ptolemy has strong provenance and no
empirical support whatsoever. Under a single axis the only options are to tag it
`SOURCED` — which readers will hear as endorsement — or `UNVERIFIED`, which
misdescribes work that is faithfully transcribed from a primary source.

Two axes let the record say both true things at once. That is the prerequisite
for publishing interpretive traditions without laundering them into the same
epistemic register as the semiconductor and astronomy corpora.

## Open items

- **MPS/0.2.** Adding the second axis to the published specification is a
  separate decision with a DOI, a public registry, and a paid auditor attached.
  Not undertaken here.
- **`scripts/expand-graph.ts`** still carries its own four-tag vocabulary and is
  unmigrated.
- **Editorial review of `established`.** 37 claims remain `established` while the
  source registry is almost entirely vendor-published. Six clear cases were
  reclassified to `interested-party`; a full editorial pass over the rest has not
  been done.
