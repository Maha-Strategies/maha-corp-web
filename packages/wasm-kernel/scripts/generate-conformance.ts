import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import * as reference from '../src/reference.ts'

type Vector = { operation: string; inputs: string[]; output: string }
const vector = (operation: string, inputs: bigint[], output: bigint): Vector => ({
  operation,
  inputs: inputs.map(String),
  output: String(output),
})
const vectors: Vector[] = []

for (const angle of [-1080000001n, -720000001n, -360000001n, -360000000n, -30000001n, -1n, 0n, 1n, 29999999n, 30000000n, 359999999n, 360000000n, 720000001n]) {
  vectors.push(vector('normalizeAngleMicrodegrees', [angle], reference.normalizeAngleMicrodegrees(angle)))
  vectors.push(vector('zodiacSignIndex', [angle], reference.zodiacSignIndex(angle)))
  vectors.push(vector('zodiacBoundaryDistanceMicrodegrees', [angle], reference.zodiacBoundaryDistanceMicrodegrees(angle)))
}
for (const [left, right] of [[0n, 0n], [0n, 1n], [0n, 180000000n], [1n, 359999999n], [-1n, 1n], [30000000n, 330000000n], [123456789n, 300000001n], [-720000001n, 720000001n]] as const) {
  vectors.push(vector('angularSeparationMicrodegrees', [left, right], reference.angularSeparationMicrodegrees(left, right)))
}
for (const [numerator, denominator] of [[5n, 2n], [7n, 2n], [-5n, 2n], [-7n, 2n], [5n, -2n], [8n, 3n], [1n, 3n], [0n, 7n], [9223372036854775807n, 1n]] as const) {
  vectors.push(vector('divideHalfEven', [numerator, denominator], reference.divideHalfEven(numerator, denominator)))
}
for (const [value, numerator, denominator] of [[1000n, 254n, 100n], [-1000n, 254n, 100n], [7n, 5n, 2n], [1n, 1n, 3n], [123456n, 1000n, 1000000n]] as const) {
  vectors.push(vector('convertScaled', [value, numerator, denominator], reference.convertScaled(value, numerator, denominator)))
}
for (const [a, b] of [[0n, 0n], [-20n, 3n], [20n, 7n], [-1000000n, 1000000n], [9223372036854775800n, 7n]] as const) {
  vectors.push(vector('intervalAddLower', [a, b], reference.intervalAddLower(a, b)))
  vectors.push(vector('intervalAddUpper', [a, b], reference.intervalAddUpper(a, b)))
}
for (const value of [0n, 1n, 2n, 3n, 4n, 8n, 9n, 24n, 25n, 26n, 15n, 16n, 17n, 999999n, 1000000n, 9223372030926249001n]) {
  vectors.push(vector('integerSqrt', [value], reference.integerSqrt(value)))
}
for (const [a, b] of [[0n, 0n], [3n, 4n], [5n, 12n], [1000n, 1000n], [123456n, 654321n]] as const) {
  vectors.push(vector('rootSumSquaresFloor', [a, b], reference.rootSumSquaresFloor(a, b)))
}
for (const [thickness, area, conductivity] of [[100n, 1000000n, 100000n], [250n, 500000n, 1500n], [1n, 1n, 1000n], [5000n, 10000000n, 200000n]] as const) {
  vectors.push(vector('layerThermalResistanceNanoKelvinPerWatt', [thickness, area, conductivity], reference.layerThermalResistanceNanoKelvinPerWatt(thickness, area, conductivity)))
}
for (const [heat, resistance] of [[0n, 1000000n], [1000n, 1000000n], [2500n, 3333333n], [125000n, 250000n]] as const) {
  vectors.push(vector('temperatureRiseMicrokelvin', [heat, resistance], reference.temperatureRiseMicrokelvin(heat, resistance)))
}

if (vectors.length < 100) throw new Error(`Conformance corpus is too small: ${vectors.length}`)
const document = {
  schemaVersion: 'maha-wasm-conformance/2.0',
  integerModel: 'signed-i64',
  rounding: 'nearest-ties-to-even',
  overflow: 'abort',
  vectors,
}
writeFileSync(resolve(import.meta.dirname, '../conformance/vectors.json'), `${JSON.stringify(document, null, 2)}\n`)
