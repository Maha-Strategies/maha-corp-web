# tool-allowlisting lineage investigation

`agentic-systems-mcp-tool-allowlisting` is declared an **initial** release. That
declaration rests on evidence gathered here rather than on a lookup returning
nothing, because those two things are not the same and only one of them
licenses a first release.

## What was checked

**The registry is not filtered to active rows.** It reported 47 rows: 46 active
and 1 superseded, with its own `counts` block enumerating `withdrawn` as a
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

Lineage is genuinely absent, and the probe reports `lineage-absent` only when
all of the following hold: the query succeeded, the registry is populated, the
record exists in the graph, and it has no row under any represented status.

## What remains unverified

The registry is a **projection**. This investigation establishes that the
projection contains no row for the record; it cannot establish that the
underlying tables contain none. If a release state existed outside the
`active` / `superseded` / `withdrawn` vocabulary, this probe would not see it.

That gap is closed by the rehearsal, not by this document: the remote run's
read-only Production step must confirm zero rows across every state before the
initial release proceeds, and `status-vocabulary-incomplete` blocks the initial
release if the vocabulary it observes is narrower than expected.
