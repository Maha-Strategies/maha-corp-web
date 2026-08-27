# @mahastrategies/evidence-dossier-builder

Operator CLI and library for compiling, validating, verifying, and rendering
Maha Evidence Dossier packages.

**Private. Not published to npm.**

## What this is, and what it is not

This package is an *extraction* of the existing dossier machinery, not a second
implementation. The schema, canonicalization, compiler, validator, and
substantial-page adapter all resolve to the canonical modules under
`lib/evidence-dossier`. Only two things are new here:

- **`verify.ts`** — verification from exported artifacts alone.
- **`jsonld.ts`** — JSON-LD rendering that keeps the evidence categories distinct.

Forking the schema would let the package drift from the corpus that produces
real dossiers and would quietly invalidate every existing digest.

## CLI

```
mps-dossier validate <input.json>
mps-dossier compile <input.json> --output <absolute-directory>
mps-dossier verify <manifest.json>
mps-dossier render-jsonld <input.json|package-directory>
```

Run it with `node --experimental-strip-types`:

```
node --experimental-strip-types packages/evidence-dossier-builder/bin/mps-dossier.ts verify ./out/manifest.json
```

PDF rendering is deliberately not included in this sprint.

## Tests

The package's tests live at `test/evidence-dossier-builder.test.ts` in the repo
test directory rather than inside the package, because the suite runner globs
`test/*.test.ts` — keeping them there means they run in the full suite on every
change, instead of only when someone remembers this package exists.

## Guarantees

- **Offline.** No network access in `validate`, `compile`, or `verify`. No source
  retrieval, implicit or otherwise. No telemetry.
- **Deterministic.** The same input produces byte-identical output. Nothing reads
  the system clock; every instant must be supplied as frozen input.
- **Verification recomputes.** `verify` recomputes every digest from the bytes on
  disk. Manifest `sha256`, `bytes`, and `packageDigest` fields are treated as
  claims to be checked, never as facts. A forgery that edits both the content and
  its declared digest still fails, because the manifest digest is recomputed too.
- **Fails closed.** Malformed input is rejected with issue codes rather than
  coerced or crashed through.
- **Evidence stays typed.** Metadata-only sources cannot become passage-supported.
  Claims must resolve to declared sources and exact locators. Prior revisions are
  never edited.
- **No secrets.** No CLI argument carries a credential; there is nothing to
  authenticate against.

## JSON-LD

Seven categories are kept as separate collections so one kind of support is never
mistaken for another:

`sourceMetadata` · `claims` · `passages` · `calculations` · `formalProofs` ·
`runtimeReceipts` · `assurance`

`calculations`, `formalProofs`, and `runtimeReceipts` have no representation in
the dossier schema today. They are emitted as **empty arrays** rather than
omitted, so their absence is explicit. They are never populated by inference.

The `assurance` block states `externalExpertReview: false`,
`independentReproduction: false`, and `certification: 'none'`.

## Assurance boundary

This tool compiles and verifies evidence packages. It asserts no external expert
review, peer review, consensus, or independent reproduction, and claims no legal,
regulatory, scientific, or commercial certification.

The internal rehearsal engagement is fixed at a **$5,000 list price, $0
contracted, $0 received**, with the fixed-fee offer **not** marked ready.
