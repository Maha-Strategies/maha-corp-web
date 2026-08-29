# @maha/wasm-kernel

An experimental deterministic fixed-point calculation kernel for Maha evidence packages. Version 0.3 exposes signed 64-bit integer operations through WebAssembly and a TypeScript reference implementation.

This package does **not** claim that WebAssembly makes floating-point science reproducible. Its ABI avoids floating-point values, declares nearest-ties-to-even rounding, aborts on detected signed-i64 overflow, and is tested against more than 100 frozen conformance vectors. Inputs must carry their scale and units in the calculation receipt.

Phase 2 adds bounded semiconductor thermal-resistance and temperature-rise primitives, plus celestial angular separation, zodiac indexing, and boundary distance. These are arithmetic primitives, not physical model validation or astrological interpretation. The thermal model is one-dimensional steady-state conduction and does not account for interfaces, spreading resistance, anisotropy, radiation, convection, or temperature-dependent conductivity.

The release-bound `kernel.wasm` artifact is committed so a private Evidence
Dossier can be verified offline from a clean checkout. `npm run build`
regenerates it from the tracked AssemblyScript source and lockfile, updates the
manifest digest, and tests compare two independent builds byte-for-byte. The
human-readable `.wat` remains generated-only.

Calculation receipts bind the kernel, compiler flags, precision policy, conformance corpus, normalized inputs, outputs, uncertainty fields, optional theorem references, and optional computational-witness receipts. The dossier adapter emits a deterministic JSON-LD attachment but does not upgrade the evidentiary status of any claim. Empty proof or witness references do not imply a proof or witnessed execution. No public Maha route imports this package.

Phase 3 adds inclusive integer intervals with outward rounding, frozen uncertainty fixtures, receipt canonicalization pinned to `maha-dossier-canonical/1.0`, and artifact-only dossier verification. Calculations are optional: absent interval inputs produce no receipt, and incomplete bounds fail instead of becoming exact or zero.

The execution-bound closure supports four explicitly registered operations:
angle normalization, layer thermal resistance, temperature rise, and interval
addition. Receipt creation computes output by executing the WASM; offline
verification ignores the claimed result and reruns the same operation against
the embedded bytes. Unknown operations, substituted kernels, stale conformance
identities, incorrect units, malformed integers, and overflow fail closed.

Current limits: transcendental functions, kinetic modules, interface thermal resistance, correlated uncertainty, probability distributions, and independent cross-compiler conformance are not implemented. Callers must remain within domain-specific validated bounds.
