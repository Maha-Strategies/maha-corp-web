export type ProgramFloor = { id: string; gross: number; assignableRatio: number }
export type ProgramInput = { unit: 'm2' | 'ft2'; floors: ProgramFloor[] }
export const PROGRAM_VERSION = 'maha-program-area/1.0'
export const SYNTHETIC_PROGRAM: ProgramInput = { unit: 'm2', floors: [{ id: 'A', gross: 1000, assignableRatio: 0.7 }, { id: 'B', gross: 1000, assignableRatio: 0.7 }] }
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function checkProgram(value: unknown) {
  if (!object(value) || Object.keys(value).sort().join(',') !== 'floors,unit' || !['m2', 'ft2'].includes(String(value.unit)) || !Array.isArray(value.floors) || value.floors.length < 1 || value.floors.length > 200) throw new Error('Provide one unit (m2 or ft2) and 1–200 floors. Unknown fields are refused.')
  const ids = new Set<string>()
  const floors = value.floors.map((row: unknown) => {
    if (!object(row) || Object.keys(row).sort().join(',') !== 'assignableRatio,gross,id' || typeof row.id !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(row.id) || ids.has(row.id)) throw new Error('Each floor needs a unique simple ID and only id, gross and assignableRatio fields.')
    if (typeof row.gross !== 'number' || !Number.isFinite(row.gross) || row.gross <= 0 || row.gross > 1e9 || typeof row.assignableRatio !== 'number' || !Number.isFinite(row.assignableRatio) || row.assignableRatio < 0 || row.assignableRatio > 1) throw new Error('Gross area must be positive and at most 1 billion; ratios must be finite numbers from 0 to 1.')
    ids.add(row.id)
    return { id: row.id, gross: row.gross, assignableRatio: row.assignableRatio }
  })
  const rows = floors.map(f => ({ ...f, assignable: f.gross * f.assignableRatio, support: f.gross - f.gross * f.assignableRatio }))
  const totals = rows.reduce((t, r) => ({ gross: t.gross + r.gross, assignable: t.assignable + r.assignable, support: t.support + r.support }), { gross: 0, assignable: 0, support: 0 })
  return { schema: PROGRAM_VERSION, inputs: { unit: value.unit as ProgramInput['unit'], floors }, formulas: ['assignable = gross × assignableRatio', 'support = gross − assignable', 'totals = sum of rows'], rows, totals, review: 'Unreviewed arithmetic; inputs supplied by visitor', limitations: ['One row per floor; no void or overlap detection.', 'Zoning and rentable areas are not calculated.', 'Not a room schedule, safety assessment or design approval.', 'IEEE-754 arithmetic; rounding is display-only.'] }
}
