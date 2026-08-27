export interface WasmScienceKernel {
  normalizeAngleMicrodegrees(value: bigint): bigint
  divideHalfEven(numerator: bigint, denominator: bigint): bigint
  convertScaled(value: bigint, numerator: bigint, denominator: bigint): bigint
  intervalAddLower(aLower: bigint, bLower: bigint): bigint
  intervalAddUpper(aUpper: bigint, bUpper: bigint): bigint
  integerSqrt(value: bigint): bigint
  rootSumSquaresFloor(a: bigint, b: bigint): bigint
}

export async function instantiateKernel(bytes: BufferSource): Promise<WasmScienceKernel> {
  const imports = { env: { abort: (): never => { throw new WebAssembly.RuntimeError('WASM kernel aborted on an invalid or overflowing operation.') } } }
  const result = await WebAssembly.instantiate(bytes, imports)
  const exports = result.instance.exports as unknown as WasmScienceKernel
  const required = ['normalizeAngleMicrodegrees', 'divideHalfEven', 'convertScaled', 'intervalAddLower', 'intervalAddUpper', 'integerSqrt', 'rootSumSquaresFloor'] as const
  for (const name of required) if (typeof exports[name] !== 'function') throw new Error(`WASM kernel export ${name} is missing.`)
  return exports
}
