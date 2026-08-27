# @maha/wasm-kernel

An experimental deterministic fixed-point calculation kernel for Maha evidence packages. Version 0.1 exposes signed 64-bit integer operations through WebAssembly and a TypeScript reference implementation.

This package does **not** claim that WebAssembly makes floating-point science reproducible. Its initial ABI avoids floating-point values, declares nearest-ties-to-even rounding, and is tested against frozen conformance vectors. Inputs must carry their scale and units in the calculation receipt.

The receipt schema has optional references for future Lean proofs and computational witnesses. Empty references do not imply a proof or witnessed execution. No public Maha route currently imports this package.

Current limits: multiplication can overflow signed i64; interval multiplication, transcendental functions, semiconductor, celestial, and kinetic modules are not yet implemented. Callers must remain within their domain-specific validated bounds.
