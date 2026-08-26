# Evidence Dossier package automation

The local compiler converts a bounded, inspected-source dossier draft into an immutable internal delivery package. It computes every passage, claim, comparison, dossier, package, and file digest; validates the dossier; evaluates the separate $5,000 offer contract; and writes a new directory without overwriting existing material.

It does not search literature, invent locators, rewrite claims, certify conclusions, publish a route, contact a customer, or record revenue automatically.

## Input

The JSON input contains:

- `dossier`: the evidence dossier fields except computed schema versions, fragment digests, and provenance bundle;
- `engagement`: either `internal-rehearsal` or `paid-pilot`, with the fixed $5,000 list price recorded separately from contracted price and cash received.

An internal rehearsal must record zero contracted revenue, zero cash received, and no customer reference. A paid pilot must record a non-zero contracted price and a bounded customer reference. This prevents internal demonstrations from becoming false commercial evidence.

Every timestamp is supplied explicitly. The compiler never inserts the current time, so the same input produces byte-identical output.

## Output

- `manifest.json`
- `dossier.json`
- `dossier.canonical.json`
- `reviewer-packet.md`
- `print-report.html`
- `claim-ledger.csv`
- `source-ledger.csv`
- `passage-ledger.csv`
- `comparison-matrix.csv`

The HTML carries `noindex,nofollow` and is a local print artifact, not a public route.

## Run

```bash
npm run compile:evidence-dossier-package -- \
  --input /absolute/path/intake.json \
  --output /absolute/path/new-package-directory
```

The output directory must not exist. The compiler refuses symlink inputs, files above 2 MB, relative outputs, broad output targets, credential-shaped command arguments, invalid dossiers, and inconsistent engagement accounting.

## Offer readiness

Schema validity and offer readiness are separate. A valid internal dossier is not automatically ready for the fixed-fee offer. The v0.1 offer gate expects:

- 8-15 claims;
- 5-12 sources, all directly inspected;
- at least one comparison;
- at least three limitations and three prohibited uses;
- internal audit completed.

The decision is binary with explicit blocker codes. It is not a quality score, a promise of demand, or a statement that the evidence is true.
