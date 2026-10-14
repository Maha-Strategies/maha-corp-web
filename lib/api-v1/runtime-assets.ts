// Next matches the route-handler template, not a concrete registry URL.
// Escape the bracket segments so picomatch treats them as literals.
export const MODULAR_RUNTIME_TRACES = {
  '/api/v1/\\[domain\\]/\\[category\\]/\\[action\\]': ['./node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm'],
}
