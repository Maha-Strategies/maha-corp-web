# Evidence Dossier + deterministic computation closure

Status: implementation-complete, internal and noncommercial

This closure defines “100%” as completion of the bounded architecture, not the
completion of every future scientific model. A package satisfies the contract
only when this chain can be verified without a network connection:

`source-bound dossier → declared operation → exact WASM execution → bounded uncertainty → calculation receipt → optional runtime witness → JSON-LD/PDF → independent replay`

## Completion contract

| Requirement | Enforced state |
| --- | --- |
| One canonical byte order | `maha-dossier-canonical/1.0`; UTF-16 code-unit key order; NFC strings; normalized instants |
| Exact executable identity | `kernel.wasm`, compiler policy, kernel digest and conformance digests embedded in each calculation-bearing package |
| Output provenance | Receipt output is created by the operation registry executing WASM, never accepted from an operator |
| Independent calculation verification | Artifact-only verifier reloads the embedded WASM and recomputes every receipt from inputs |
| Uncertainty | Inclusive interval addition executes lower and upper bounds separately; absence remains empty |
| Evidence binding | Each receipt is bound to a declared dossier claim; calculations do not create source or passage support |
| Runtime provenance | Computational Witness receipts remain a separate optional category and must bind the dossier, claims and calculation receipt ids |
| Presentation parity | JSON-LD and PDF are deterministically rerendered from exported artifacts and byte-compared |
| Offline operator path | `compile-integrated` and `verify-integrated` require no network or credentials |
| No-calculation behavior | A dossier without a justified calculation contains no kernel and claims no calculation assurance |

## Registered operations

- Celestial angle normalization in integer microdegrees.
- One-dimensional layer thermal resistance in integer fixed-point units.
- Temperature rise from integer heat and thermal-resistance inputs.
- Inclusive interval addition with explicit common units.

These are arithmetic implementations, not validation of a physical model or
proof that a claim is scientifically true. The thermal operations preserve the
existing one-dimensional steady-state model boundary.

## Fail-closed conditions

Packages are refused or fail verification for an unknown operation, missing
execution request, substituted or altered kernel, stale conformance identity,
different compiler/arithmetic policy, malformed or out-of-range integer,
incorrect units, arithmetic overflow, altered output or uncertainty, duplicate
receipt, foreign claim or dossier binding, invalid witness binding, or
non-reproducible JSON-LD/PDF.

## Deliberately outside this closure

- New scientific models and domain equations.
- Floating-point, transcendental or probabilistic kernels.
- Correlated uncertainty and distribution fitting.
- Formal Lean proofs and independent cross-compiler reproduction.
- External expert review, regulatory certification or commercial readiness.

Those are additive future capabilities. They do not reopen the completed
integrity, execution, binding and offline-verification architecture.
