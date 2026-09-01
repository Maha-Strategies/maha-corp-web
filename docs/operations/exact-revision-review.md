# Exact-revision review: the 38 alignment-clear unreleased records

Internal-editorial review, automated, **not independent and not expert
endorsement**. It records what the committed evidence settles and sends back
what it does not.

## What was previously unobservable

The scaling inventory could only read review state off an active canonical
release, so a record reviewed and not released was indistinguishable from one
never reviewed, and the capacity model's canonical-release bucket could never
fill. Review state is now projected from committed decision corpora keyed by
the exact revision digest, and that bucket reads **30**.

## Review state of the 38

| state | records |
|---|---:|
| `approved-for-exact-revision` | 30 |
| `rejected` | 1 |
| `revise-requested` | 7 |

| classification | records |
|---|---:|
| `rejected` | 1 |
| `release-ready` | 30 |
| `revise-and-rereview` | 7 |

Before this sprint, exactly **one** of the 38 carried any committed decision: a
Batch 11 hold that did not authorize canonical release. The other 37 had none.
They were not reviewed-and-waiting; they had never been decided.

## What separated them

Every one of the 38 shares the same profile - subject `supported`, source
`independently-curated`, content inspected, exact locator present, rights basis
present, boundary present, one claim over one source. The axis that separated
them is **claim-to-passage support**, and the evidence that separated them is
inspection depth:

- **section or full-text inspection** - the named passage was read, so a
  metadata-level claim is carried. Approved on all five axes.
- **abstract or metadata only** - an abstract can confirm a paper is about a
  subject, but not that a named section supports a named scope. Claim-to-passage
  and scope are **revised**, not approved on a weaker reading than they require.

That is the whole of the disagreement, and it is recorded per record with the
inspection location it was drawn from.

## What was checked and deliberately not treated as a blocker

All 38 carry metadata-level claim statements and a malformed scope join. Both
looked like blockers until they were controlled: **67 of the 114 already-released
records share both patterns, and 56 of them already have substantial pages**.
Treating either as disqualifying would have invented a standard the corpus does
not apply and implicitly condemned the majority of the live surface. The
malformed scope join is a real corpus-wide defect and deserves its own fix; it
is not a reason to hold this cohort.

## Canary

Five release-ready records, one per domain, alphabetically first.

| record | domain | inspection |
|---|---|---|
| `agentic-systems-mcp-mcp-session-lifecycle` | agentic-systems-mcp | section-or-full-text |
| `biomolecular-engineering-crude-extract-cell-free-systems` | biomolecular-engineering | section-or-full-text |
| `critical-supply-chains-gallium-bauxite-byproduct-flow` | critical-supply-chains | section-or-full-text |
| `fusion-plasma-systems-laser-target-coupling` | fusion-plasma-systems | section-or-full-text |
| `longevity-metabolism-apoptosis-in-senescent-cells` | longevity-metabolism | section-or-full-text |

**Nothing here has been released.** The Preview plan in
`content/review/preview-release-plan.json` is generated and undispatched.

## Counts, kept separate

| | count |
|---|---:|
| Alignment-clear | 141 |
| Reviewed for exact revision | 30 |
| Release-ready | 30 |
| Canonically released | 114 |
| Substantial-page compiled | 103 |
| Publicly reachable | 764 |
| In sitemap.xml | 764 |
| In llms.txt | 190 |

Release-ready is a prepared state, not a published one. Nothing in this sprint
was released, compiled to a page, or made reachable.
