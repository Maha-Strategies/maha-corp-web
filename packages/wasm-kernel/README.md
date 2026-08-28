# @maha/wasm-kernel

An experimental deterministic fixed-point calculation kernel for Maha evidence packages. Version 0.2 exposes signed 64-bit integer operations through WebAssembly and a TypeScript reference implementation.

This package does **not** claim that WebAssembly makes floating-point science reproducible. Its ABI avoids floating-point values, declares nearest-ties-to-even rounding, aborts on detected signed-i64 overflow, and is tested against more than 100 frozen conformance vectors. Inputs must carry their scale and units in the calculation receipt.

Phase 2 adds bounded semiconductor thermal-resistance and temperature-rise primitives, plus celestial angular separation, zodiac indexing, and boundary distance. These are arithmetic primitives, not physical model validation or astrological interpretation. The thermal model is one-dimensional steady-state conduction and does not account for interfaces, spreading resistance, anisotropy, radiation, convection, or temperature-dependent conductivity.

The `.wasm` and `.wat` outputs are intentionally not committed. `npm run build` regenerates them from the tracked AssemblyScript source and lockfile; `npm pack` invokes the same build through `prepack`. Tests compile into a temporary directory and compare two independent builds byte-for-byte.

Calculation receipts bind the kernel, compiler flags, precision policy, conformance corpus, normalized inputs, outputs, uncertainty fields, optional theorem references, and optional computational-witness receipts. The dossier adapter emits a deterministic JSON-LD attachment but does not upgrade the evidentiary status of any claim. Empty proof or witness references do not imply a proof or witnessed execution. No public Maha route imports this package.

Current limits: interval multiplication, transcendental functions, kinetic modules, interface thermal resistance, and independent cross-compiler conformance are not implemented. Callers must remain within domain-specific validated bounds.
