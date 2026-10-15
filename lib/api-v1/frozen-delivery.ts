import { demandDigest } from '../x402/demand6/digest.ts'
import { calculationDigest } from '../x402/celestial-products.ts'

// libm/V8 may differ at the last floating-point bit across CPU/OS builds.
// This is a numeric comparison policy, not permission to ignore integrity
// hashes or other fields. Never rewrite the delivered response or receipt.
export const POSITION_COMPARISON_TOLERANCE_DEGREES = 1e-10
type Position = { tropicalLongitude: number; siderealLongitude: number }
type Snapshot = { resultHash: string; result: { receiptDigest: string; result: { ayanamsaDegrees: number; positions: Position[] } } }
export function assertFrozenDelivery(id: string, actual: unknown, expected: unknown): void {
  if (demandDigest(actual) === demandDigest(expected)) return
  if (id !== 'celestial-position-snapshot') throw Error('deterministic_delivery_mismatch')
  const value = structuredClone(actual) as Snapshot, reference = expected as Snapshot
  const { receiptDigest, ...payload } = value.result
  if (value.resultHash !== demandDigest(value.result) || receiptDigest !== calculationDigest(payload)) throw Error('celestial_integrity_mismatch')
  const measured = value.result.result, pinned = reference.result.result
  if (!Array.isArray(measured.positions) || measured.positions.length !== 7 || pinned.positions.length !== 7) throw Error('celestial_positions_mismatch')
  const compare = (a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > POSITION_COMPARISON_TOLERANCE_DEGREES) throw Error('celestial_numeric_mismatch')
    return b
  }
  measured.ayanamsaDegrees = compare(measured.ayanamsaDegrees, pinned.ayanamsaDegrees)
  measured.positions.forEach((position, index) => {
    position.tropicalLongitude = compare(position.tropicalLongitude, pinned.positions[index].tropicalLongitude)
    position.siderealLongitude = compare(position.siderealLongitude, pinned.positions[index].siderealLongitude)
  })
  // Compare every other byte-equivalent field after verifying the hashes of
  // the original, unmodified response and normalizing only the numeric paths.
  const { receiptDigest: _originalDigest, ...normalized } = value.result
  value.result.receiptDigest = calculationDigest(normalized)
  value.resultHash = demandDigest(value.result)
  if (demandDigest(value) !== demandDigest(reference)) throw Error('celestial_frozen_metadata_mismatch')
}
