# @maha/lean-bridge

A private, offline-first Lean 4 package binding machine-checked theorems to
Evidence Dossier claims.

**Status: all 21 theorems are machine-checked in CI.** Six depend on no axiom at
all; the remaining fifteen rest only on Lean's own `propext`, `Classical.choice`
and `Quot.sound`. See "Verification status" below.

## What this is for

A dossier claim can carry a formal proof alongside its source passages. The
proof establishes a conditional statement — *if these assumptions, then this
conclusion* — and nothing more. It never becomes evidence that the assumptions
describe reality.

The full boundary is documented in [`docs/machine-infrastructure.md`](../../docs/machine-infrastructure.md).

## Toolchain

```
leanprover/lean4:v4.33.1
```

Pinned in `lean-toolchain`. No dependencies, mathlib included: every theorem is
stated over Lean's own `Int` and `List`, so verification needs no network access
once the toolchain is installed.

## Verifying

```bash
lake build                                              # proofs must elaborate
node --experimental-strip-types scripts/axiom-check.ts  # and have no holes
```

Both are required. `sorry` produces a warning rather than an error, so a green
`lake build` alone does not establish that anything was proved. The axiom check
reads each theorem's dependencies out of the elaborated environment and fails on
`sorryAx` or on any axiom outside Lean's own three.

## Regenerating the manifest

```bash
node --experimental-strip-types scripts/generate-manifest.ts
```

Writes `fixtures/formal-proof-manifest.json`. The manifest records what the
package claims to prove and from which exact source bytes; it does not assert
that anything was proved. Generation and verification are deliberately separate,
so a manifest can never vouch for itself.

## Verification status

Machine-checking runs in CI (`.github/workflows/lean-formal-bridge.yml`) on
Linux with Lean 4.33.1. The workflow builds the proofs, reads every theorem's
axiom dependencies out of the elaborated environment, requires the regenerated
manifest to be unchanged, and rebuilds from a cleared `.lake` to confirm the
manifest is identical across two independent builds.

Last verified result:

```
theoremsChecked: 21
axiomFree: 6
restingOnPermittedAxiomsOnly: 15
```

The toolchain could not be installed in the environment where this package was
written — the 556 MB download ran at 2-6 KB/s — so local runs skip Lean and the
unit tests inject the Lean result instead. Those tests establish that the
refusal logic works, not that the theorems hold. **The theorems hold because the
CI workflow is green**, and an attachment may carry `machineChecked: true` only
for a commit where it is.

## Build output

`.lake/`, `build/` and `*.olean` are never committed. A compiled artifact cannot
be shown to correspond to the source it claims to come from, and its embedded
paths are machine-specific. Verifiers recheck from source with the pinned
toolchain.
