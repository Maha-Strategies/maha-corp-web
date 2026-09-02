# Source-reference page governance

**Model A: projection of released claims.** A source-reference page states only
what already-released records state. It gains no factual authority of its own
and requires no canonical release of its own.

## Why not Model B

Model B — giving each source page its own exact-revision review and canonical
release — was rejected for a specific failure mode, not on cost.

A page released in its own right can outlive the withdrawal of the record it
drew from. If a record is superseded or withdrawn, its claim leaves the record
ledger, but a separately-released page keeps standing behind its own release.
The page then becomes the only place a retracted claim still appears, and it
appears there with canonical authority. That is the worst possible place for it.

Model B also creates a second ledger to keep in sync with the first, and every
sync gap is a window in which the two disagree about what the corpus asserts.

Projection cannot fail that way because it has nothing of its own. Withdraw the
record and the claim leaves the page in the same act.

## How it fails closed

Every displayed claim must trace to an **active released revision**. The gate
does not silently drop an unreleased claim and render a smaller page — a single
unreleased claim refuses the whole page. Silently shrinking is how an aggregate
starts disagreeing with its records, and a reader cannot see it happen.

A page left with no released claims is not eligible. A source backing exactly
one released record is refused as a duplicate of that record's own page.

## What the tier claims

Automated internal editorial review, unchanged from the merged declaration:

| assurance | value |
|---|---|
| `reviewerKind` | `automated-internal-editorial` |
| `humanReviewed` | false |
| `independent` | false |
| `externallyReviewed` | false |
| `expertEndorsement` | false |
| `releaseAuthority` | separate |

The reviewer does not hold release authority, and a source page does not
acquire it by aggregating.

## Why this cannot repeat the positional-source defect

The legacy corpus grew topic-first: choose a subject, then find a citation. That
produced 48 sources spread across 238 records, 40 of them assigned to exactly
five records each — one per record kind. It is the shape of a template, and
Batch 12B found seven of fifteen records citing sources about other subjects
entirely.

A source-reference page has no step at which a topic goes looking for a
citation. It begins at a source that was opened and read, and can only say what
that reading and the released records support. If the source turns out to be
about something else, there is no page — which is what happened to eight of the
forty-eight here.
