# tool-allowlisting lineage investigation

`agentic-systems-mcp-tool-allowlisting` has no release lineage in the observed
registry. It is no longer part of the executable Batch 11 cohort: its review
decision requires a claim-scope revision while the revision builder preserves
the original claim form. This document retains the lineage investigation as an
append-only finding; it does not license a release.

## What was checked

**The registry is not filtered to active rows.** The latest frozen observation
reported 115 rows and includes a superseded row, with its own `counts` block enumerating `withdrawn` as a
category it represents. A superseded row for
`advanced-materials-hexagonal-boron-nitride-dielectrics` is present, together
with the superseding row that points at it. So lineage *is* visible in this
projection when it exists.

**The record has no row under any status.** The string `tool-allowlisting` does
not appear anywhere in the registry payload, and no row carries it as a
`recordId`.

**A rename was considered and disproven.** The registry contains
`agentic-systems-mcp-tool-deny-by-default`, which is close enough in meaning to
be a plausible predecessor. It is not one: both records exist in the domain
graph simultaneously, and they differ in kind — `tool-allowlisting` is a
`measurement`, `tool-deny-by-default` is a `comparison` — with different claims.
An adjacent record having a release is not lineage for this one.

## Conclusion

Lineage was absent in the all-status observation, and the probe reports `lineage-absent` only when
all of the following hold: the query succeeded, the registry is populated, the
record exists in the graph, and it has no row under any represented status.

## What remains unverified

The registry is a **projection**. This investigation establishes that the
projection contains no row for the record; it cannot establish that the
underlying tables contain none. If a release state existed outside the
`active` / `superseded` / `withdrawn` vocabulary, this probe would not see it.

The record remains excluded from the rehearsal for the independent evidence
reason above. If it is reconsidered in a future cohort, a fresh read-only
Production probe must again confirm zero rows across every state before an
initial release proceeds; `status-vocabulary-incomplete` must continue to fail
closed.
