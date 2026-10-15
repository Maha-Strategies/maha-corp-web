import { z } from 'zod'
import { object, id, list, finding as f, metric as m, unique, type AuditResult } from './batch5-core.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
export const qubit = z.number().int().min(0).max(1023)
export const qubitCount = z.number().int().min(1).max(1024)
export const parameter = object({ parameterRef: id, value: z.number().finite().min(-1e9).max(1e9), unit: z.enum(['radians', 'degrees', 'dimensionless']) })
export const operation = object({ id, gateRef: id, qubits: list(qubit, 1, 4), parameters: list(parameter, 0, 4) })
export type Operation = z.infer<typeof operation>
export const rotation = { id: 'op1', gateRef: 'rotation', qubits: [0], parameters: [{ parameterRef: 'angle', value: 1, unit: 'radians' }] }
export const quantumBoundary = 'Caller-supplied public/synthetic nonpersonal metadata only. No quantum simulation, device/API access, execution, calibration measurement, scientific validation or claim of circuit equivalence.'
export const calibrationBoundary = 'Caller-supplied public/synthetic nonpersonal calibration declarations only. No hardware measurement, device/API access, recalibration, mitigation, performance guarantee or scientific certification.'
export function orderedDiff(before: Operation[], after: Operation[], prefix: string): AuditResult {
  unique(before.map(r => r.id)); unique(after.map(r => r.id))
  const a = new Map(after.map(r => [r.id, r])), b = new Set(before.map(r => r.id))
  const findings = before.flatMap(r => !a.has(r.id) ? [f(prefix + '-operation-removed', r.id)]
    : demandDigest(r) !== demandDigest(a.get(r.id)) ? [f(prefix + '-operation-changed', r.id)] : [])
  findings.push(...after.filter(r => !b.has(r.id)).map(r => f(prefix + '-operation-added', r.id)))
  const left = before.filter(r => a.has(r.id)).map(r => r.id), right = after.filter(r => b.has(r.id)).map(r => r.id)
  if (left.some((v, n) => right[n] !== v)) findings.push(f(prefix + '-shared-operation-order-changed', ...left))
  return { findings, metrics: [m(prefix + '-operation-differences', 'circuit', findings.length)] }
}
export function edgeCycles(edges: { childId: string; parentId: string }[]) {
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean => {
    if (from === to) return true
    if (seen.has(from)) return false
    seen.add(from)
    return edges.filter(e => e.childId === from).some(e => reaches(e.parentId, to, seen))
  }
  return (child: string, parent: string) => reaches(parent, child)
}
