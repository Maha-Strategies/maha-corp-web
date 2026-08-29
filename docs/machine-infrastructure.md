# Machine infrastructure: what each layer establishes

Maha's evidence stack has five layers that are routinely confused with one
another. They are kept separate in the schema, in the renderer, and in a Lean
theorem, so that conflating them fails a test rather than merely contradicting a
style guide.

| Layer | What it establishes | What it cannot establish |
|---|---|---|
| **Source evidence** | A named passage in an inspected document says a particular thing | That the passage is correct |
| **Formal deduction** | A conclusion follows from stated assumptions | That the assumptions hold of anything real |
| **Deterministic computation** | A named operation on named inputs yields a named output | That the operation models the situation |
| **Observed runtime provenance** | A specific execution happened, with recorded inputs and outputs | That the result generalizes |
| **Independent reproduction** | A separate party obtained the same result | *Not currently produced by any part of this system* |

The rule that connects them: **no layer upgrades another.** A formal proof does
not strengthen a claim's source support. A calculation does not make a claim
empirical. A runtime witness does not make a computation correct.

## What Lean proves here

`packages/maha-lean-bridge` contains small theorems over exact integers:

- **Intervals** — bound-wise addition preserves ordering, contains every sum of
  members, is commutative, and has the zero interval as identity.
- **Angles** — normalization lands in `[0, 360000)` millidegrees and is
  idempotent; angular separation is nonnegative and bounded by half a circle.
- **Thermal** — in an idealized one-dimensional steady-state model, resistance
  is nonnegative under positive area and conductivity, and temperature rise is
  nonnegative under nonnegative heat and resistance.
- **Evidence boundary** — attaching a formal proof leaves a claim's declared
  assumptions untouched, and adds no empirical support.

That last group is the unusual one: it formalizes our own bookkeeping so that a
future change quietly conflating proof with observation fails to compile.

## What Lean does not prove here

Stated plainly, because these are the misreadings that matter:

1. **Not the kernel.** No theorem relates these definitions to the AssemblyScript
   source or the compiled WASM binary. `compilerEquivalenceProven` is `false` and
   must stay `false` until such a proof genuinely exists.
2. **Not the physics.** The thermal model is one-dimensional steady-state
   conduction. It says nothing about interface resistance, spreading resistance,
   anisotropy, radiation, convection, or temperature-dependent conductivity. A
   proof about it is not thermal validation.
3. **Not overflow.** The theorems are over unbounded `Int`. The kernel computes
   in signed 64-bit fixed point. The gap is deliberate and is recorded in each
   attachment's `informalBoundary`.
4. **Not empirical anything.** `empiricallyValidated`, `independentlyReproduced`
   and `scientificModelCertified` are structurally `false`.

## Toolchain and verification command

```
lean-toolchain:  leanprover/lean4:v4.33.1
verification:    lake build
axiom check:     node --experimental-strip-types scripts/axiom-check.ts
```

No dependencies, mathlib included. Every theorem is stated over Lean's own `Int`
and `List`, so verification needs no network access once the toolchain is
installed.

## Why the exit status is not sufficient on its own

`sorry` produces a **warning**, not an error. A file full of `sorry` compiles and
`lake build` exits zero. Anyone treating a green build as proof of completeness
is verifying nothing.

So verification has two required parts:

1. `lake build` exits zero — the source elaborates.
2. `#print axioms <theorem>` reports only `propext`, `Classical.choice` and
   `Quot.sound` — the proof has no holes and rests on no invented axiom.

The second is read out of the elaborated environment and cannot be faked by
editing text. A token scan for `sorry` is kept as a cheap first refusal, not as
the guarantee.

## Failure modes the verifier refuses

Each of these is covered by a test:

- a Lean build failure;
- a `sorryAx` dependency despite a green build;
- a caller-supplied `machineChecked: true`;
- a caller-supplied empirical, reproduction, compiler-equivalence or
  certification flag;
- a stale source digest, stale toolchain, or stale proof manifest;
- a changed theorem statement;
- an unknown theorem;
- a duplicate theorem id or a theorem attached twice;
- a substituted dossier or an undeclared claim;
- an attachment with no stated boundary.

A failure never downgrades to a warning. An attachment either earns
`machineChecked` from a real Lean run or does not appear in the output at all.

## Package format

```
packages/maha-lean-bridge/
  lean-toolchain                    exact pinned toolchain
  lakefile.toml                     Lake project, no dependencies
  Maha.lean                         root module
  Maha/                             theorem sources
  src/                              schema, canonicalization, compiler, verifier, dossier projection
  scripts/generate-manifest.ts      builds the proof manifest from source
  scripts/axiom-check.ts            reads axiom dependencies out of Lean
  fixtures/                         claim bindings and the generated manifest
```

Build output — `.lake/`, `build/`, `*.olean` — is never committed. A compiled
artifact cannot be shown to correspond to the source it claims to come from, and
its embedded paths are machine-specific.

## Determinism

- Object keys are sorted by Unicode code point, never `localeCompare`, which is
  locale-sensitive.
- Source digests are taken over text with line endings normalized to `LF`, so a
  checkout on another platform hashes identically.
- No timestamp is read during compilation.
- No absolute path enters any artifact; a test asserts this.
- Theorems are sorted by qualified name, so generation order cannot move the
  manifest digest.

### The portability boundary

Compiled Lean artifacts are **not** claimed to be byte-portable across platforms.
This package therefore distributes and hashes **deterministic source plus a
reproducible verification manifest**, not compiled `.olean` files. A verifier
rechecks the proofs from source with the pinned toolchain rather than trusting a
binary someone else produced.

## Versioning policy

`maha-formal-proof-attachment/0.1` is the current attachment schema.

- Adding a theorem is additive; the manifest digest changes and attachments
  citing the old digest are refused until regenerated. That refusal is the
  intended behaviour, not friction to be worked around.
- Changing a theorem statement invalidates every attachment citing it.
- Upgrading the toolchain invalidates every attachment, because
  `leanVersion` is part of the binding. Proofs must be rechecked, not
  re-labelled.
- A prior package is read according to the version it declares. Packages
  predating formal proofs are never retroactively described as formally
  verified.

## Why no proof changes empirical status automatically

A claim in a dossier is supported by passages in inspected sources. Those
passages are what make it an empirical claim. A Lean theorem establishes an
implication: *if* the stated assumptions hold, *then* the stated conclusion
follows. It supplies the arrow, never the antecedent.

If the assumptions are wrong about the world, the proof remains valid and the
claim remains unsupported. This is why `attach_preserves_assumptions` is a
theorem rather than a comment: attaching a proof provably leaves the assumption
list untouched, so no amount of formal work can quietly discharge an empirical
premise.
