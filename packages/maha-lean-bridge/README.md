# @maha/lean-bridge

A private, offline-first Lean 4 package binding machine-checked theorems to
Evidence Dossier claims.

**Status: the theorems in this package have not yet been machine-checked.**
See "Verification status" below. Until the Lean workflow is green, every
attachment carries `proofStatus: "unverified"` and `machineChecked: false`.

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
Linux, where the Lean toolchain can be installed. It was not possible to install
the 556 MB toolchain in the environment where this package was written, so the
proofs here are **written but unchecked**. The verifier's refusal behaviour is
fully tested with injected Lean results; that establishes the gates work, not
that the theorems hold.

Treat any theorem here as unproven until the Lean workflow is green.

## Build output

`.lake/`, `build/` and `*.olean` are never committed. A compiled artifact cannot
be shown to correspond to the source it claims to come from, and its embedded
paths are machine-specific. Verifiers recheck from source with the pinned
toolchain.
