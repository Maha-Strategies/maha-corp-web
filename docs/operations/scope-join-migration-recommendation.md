# Scope-join repair: migration recommendation

A recommendation, not migration code. Nothing in this repository applies the
repair, and this sprint deliberately did not begin it.

## The defect

`lib/frontier-domain-graphs.ts` builds a claim scope as

```
`Limited to ${citedSource.exactLocator} in “${citedSource.title}”; this candidate ...`
```

Most locators already end in a full stop, so the rendered scope reads
`... correction coil sections. in “Magnets”`. The sentence is broken. Nothing
about the evidence is: the locator and the source title are both unchanged, and
the repair removes exactly one character at the join.

## Why it has not been applied

Records are generated at module load, so correcting the template changes every
affected record immediately. A record digest covers its claims, and a digest is
what an exact-revision review and an active canonical release are both bound to.

| | count |
|---|---:|
| Records carrying the defect | 238 |
| Exact-revision reviews that would be invalidated | 33 |
| Active canonical releases that would desync from their records | 65 |

Applying it as a formatting fix would silently invalidate the entire
release-ready cohort and leave 65 live releases naming a revision that no longer
exists. That is not a formatting change in effect, whatever it is in intent.

## Recommended sequence

1. **Freeze.** Take a digest snapshot of all 238 affected records and of the 65
   releases that name them, so the before-state is reconstructible.
2. **Correct the generator** in a change that does nothing else, and regenerate.
   The repair is provably formatting-only and idempotent; a test asserts both.
3. **Re-run exact-revision review** for all 238. Existing decisions name the old
   digest and must not be carried across: a decision is about a revision, not
   about a record.
4. **Reconcile the 65 releases.** Each needs either a superseding release naming
   the corrected revision, or an explicit decision to leave the release bound to
   the superseded one. Both are governed acts; neither is automatic.
5. **Verify** that no public route changed content, and that sitemap and
   llms.txt still list exactly the records they listed before.

Steps 3 and 4 are the work. Step 2 is an afternoon.

## What must not happen

- The repair must not be bundled with an evidence sprint. It cannot be reviewed
  properly alongside anything else, and a formatting diff across 238 records is
  where a substantive change would hide best.
- Old decisions must not be carried onto corrected revisions.
- The 65 releases must not be left unreconciled on the grounds that the text
  "did not really change".
