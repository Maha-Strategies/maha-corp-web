import { z } from 'zod'
import { input, records, id, digest, utc, list, spec, hash, otherHash, time, later, finding as f, metric as m, unique, type AuditSpec } from './batch5-core.ts'
import { recordAuditSuite } from './batch9-record-suite.ts'
import { demandDigest } from '../x402/demand6/digest.ts'
import { operation, rotation, qubitCount, orderedDiff, edgeCycles, quantumBoundary } from './batch10-quantum-core.ts'
const prefix = 'quantum-circuit-records-', code = (s: string) => 'qcir-' + s
const pins = { backendRef: id, circuitRef: id, circuitRevision: digest, operationsDigest: digest, scopeRef: id, qubitCount }
const row = { id: 'circuit1', backendRef: 'backend1', circuitRef: 'circuit1', circuitRevision: hash, operationsDigest: hash, scopeRef: 'public-metadata', qubitCount: 2 }
const makeDescription = (s: string) => s + ' ' + quantumBoundary
const custom: AuditSpec[] = [
  spec(prefix + 'duplicate-record-identities', makeDescription('Group circuit/backend/revision frames and distinguish exact pinned duplicates from conflicts in operation digest, register size or scope. Ingestion IDs are not circuit identity.'),
    input({ rows: records(pins) }), { rows: [row] }, { rows: [row, { ...row, id: 'circuit2' }] },
    [code('duplicate-frame'), code('frame-conflict')], [code('distinct-circuit-frames')], i => {
      unique(i.rows.map(r => r.id)); const groups = new Map<string, typeof i.rows>()
      for (const r of i.rows) { const key = demandDigest([r.backendRef, r.circuitRef, r.circuitRevision]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => g.length > 1).map(g => f(code(new Set(g.map(r => demandDigest([r.operationsDigest, r.qubitCount, r.scopeRef]))).size === 1 ? 'duplicate-frame' : 'frame-conflict'), ...g.map(r => r.id))), metrics: [m(code('distinct-circuit-frames'), 'circuit', groups.size)] }
    }),
  spec(prefix + 'unit-label-consistency', makeDescription('Compare parameter unit declarations within exact circuit/revision/gate/parameter frames. Degrees, radians and dimensionless labels are not silently converted or treated as equivalent.'),
    input({ parameters: records({ circuitRef: id, revision: digest, gateRef: id, parameterRef: id, unit: z.enum(['radians', 'degrees', 'dimensionless']), value: z.number().finite().min(-1e9).max(1e9) }) }),
    { parameters: [{ id: 'p1', circuitRef: 'circuit1', revision: hash, gateRef: 'rotation', parameterRef: 'angle', unit: 'radians', value: 1 }] },
    { parameters: [{ id: 'p1', circuitRef: 'circuit1', revision: hash, gateRef: 'rotation', parameterRef: 'angle', unit: 'radians', value: 1 }, { id: 'p2', circuitRef: 'circuit1', revision: hash, gateRef: 'rotation', parameterRef: 'angle', unit: 'degrees', value: 1 }] },
    [code('parameter-unit-conflict')], [code('parameter-frames')], i => {
      unique(i.parameters.map(r => r.id)); const groups = new Map<string, typeof i.parameters>()
      for (const r of i.parameters) { const key = demandDigest([r.circuitRef, r.revision, r.gateRef, r.parameterRef]); groups.set(key, [...(groups.get(key) ?? []), r]) }
      return { findings: [...groups.values()].filter(g => new Set(g.map(r => r.unit)).size > 1).map(g => f(code('parameter-unit-conflict'), ...g.map(r => r.id))), metrics: [m(code('parameter-frames'), 'circuit', groups.size)] }
    }),
  spec(prefix + 'timestamp-order-audit', makeDescription('Check caller-declared circuit creation and export times against assessment time. This reports chronology metadata, not actual device availability or verified publication dates.'),
    input({ assessedAt: utc, rows: records({ createdAt: utc, exportedAt: utc }) }),
    { assessedAt: later, rows: [{ id: 'circuit1', createdAt: time, exportedAt: time }] }, { assessedAt: later, rows: [{ id: 'circuit1', createdAt: later, exportedAt: time }] },
    [code('export-before-creation'), code('timestamp-from-future')], [code('checked-circuit-times')], i => {
      unique(i.rows.map(r => r.id)); return { findings: i.rows.flatMap(r => [...(r.exportedAt < r.createdAt ? [f(code('export-before-creation'), r.id)] : []), ...(r.createdAt > i.assessedAt || r.exportedAt > i.assessedAt ? [f(code('timestamp-from-future'), r.id)] : [])]), metrics: [m(code('checked-circuit-times'), 'circuit', i.rows.length)] }
    }),
  spec(prefix + 'reference-integrity-map', makeDescription('Check operand indices, repeated operands and references to caller-declared gate arities. Register indices are zero-based; instruction names alone do not establish an implemented gate.'),
    input({ qubitCount, gates: records({ arity: z.number().int().min(1).max(4) }), operations: list(operation, 1, 32) }),
    { qubitCount: 2, gates: [{ id: 'rotation', arity: 1 }], operations: [rotation] }, { qubitCount: 2, gates: [{ id: 'rotation', arity: 1 }], operations: [{ ...rotation, qubits: [2] }] },
    [code('operand-outside-register'), code('gate-reference-missing'), code('gate-arity-mismatch'), code('duplicate-operand'), code('duplicate-parameter')], [code('valid-declared-operation-references')], i => {
      unique(i.gates.map(r => r.id)); unique(i.operations.map(r => r.id)); const gates = new Map(i.gates.map(r => [r.id, r])); let valid = 0
      const findings = i.operations.flatMap(r => { const gate = gates.get(r.gateRef), issues = [...(r.qubits.some(q => q >= i.qubitCount) ? [f(code('operand-outside-register'), r.id)] : []), ...(!gate ? [f(code('gate-reference-missing'), r.id)] : gate.arity !== r.qubits.length ? [f(code('gate-arity-mismatch'), r.id)] : []), ...(new Set(r.qubits).size !== r.qubits.length ? [f(code('duplicate-operand'), r.id)] : []), ...(new Set(r.parameters.map(p => p.parameterRef)).size !== r.parameters.length ? [f(code('duplicate-parameter'), r.id)] : [])]; if (!issues.length) valid++; return issues })
      return { findings, metrics: [m(code('valid-declared-operation-references'), 'circuit', valid)] }
    }),
  spec(prefix + 'condition-coverage-map', makeDescription('Compare operation gate/ordered-operand targets with exactly one supplied availability declaration. Missing, unknown or conflicting declarations cannot establish support. Coupling direction is explicit.'),
    input({ requiredTargets: records({ gateRef: id, qubits: list(z.number().int().min(0).max(1023), 1, 4) }), checks: records({ gateRef: id, qubits: list(z.number().int().min(0).max(1023), 1, 4), state: z.enum(['supported', 'unsupported', 'unknown']) }) }),
    { requiredTargets: [{ id: 't1', gateRef: 'cx', qubits: [0, 1] }], checks: [{ id: 's1', gateRef: 'cx', qubits: [0, 1], state: 'supported' }] },
    { requiredTargets: [{ id: 't1', gateRef: 'cx', qubits: [0, 1] }], checks: [{ id: 's1', gateRef: 'cx', qubits: [0, 1], state: 'unknown' }] },
    [code('target-support-not-established')], [code('targets-with-unique-support')], i => {
      unique(i.requiredTargets.map(r => r.id)); unique(i.requiredTargets.map(r => demandDigest([r.gateRef, r.qubits]))); unique(i.checks.map(r => r.id)); let supported = 0
      const findings = i.requiredTargets.flatMap(r => { const matches = i.checks.filter(c => c.gateRef === r.gateRef && demandDigest(c.qubits) === demandDigest(r.qubits)); if (matches.length === 1 && matches[0].state === 'supported') { supported++; return [] }; return [f(code('target-support-not-established'), r.id)] })
      return { findings, metrics: [m(code('targets-with-unique-support'), 'circuit', supported)] }
    }),
  spec(prefix + 'declared-bound-audit', makeDescription('Check declared register size, depth and instruction count against caller limits; separately reconcile supplied operation count and occupied operands. Not a resource estimate or feasibility certificate.'),
    input({ maximumQubits: qubitCount, maximumDepth: z.number().int().min(0).max(1e6), maximumOperations: z.number().int().min(0).max(32), qubitCount, declaredDepth: z.number().int().min(0).max(1e6), declaredOperations: z.number().int().min(0).max(32), operations: list(operation, 0, 32) }),
    { maximumQubits: 2, maximumDepth: 10, maximumOperations: 2, qubitCount: 2, declaredDepth: 1, declaredOperations: 1, operations: [rotation] },
    { maximumQubits: 2, maximumDepth: 10, maximumOperations: 2, qubitCount: 3, declaredDepth: 1, declaredOperations: 1, operations: [rotation] },
    [code('qubit-ceiling-exceeded'), code('depth-ceiling-exceeded'), code('operation-ceiling-exceeded'), code('declared-operation-count-mismatch'), code('operand-outside-register')], [code('supplied-operation-count')], i => {
      unique(i.operations.map(r => r.id)); return { findings: [...(i.qubitCount > i.maximumQubits ? [f(code('qubit-ceiling-exceeded'))] : []), ...(i.declaredDepth > i.maximumDepth ? [f(code('depth-ceiling-exceeded'))] : []), ...(Math.max(i.operations.length, i.declaredOperations) > i.maximumOperations ? [f(code('operation-ceiling-exceeded'))] : []), ...(i.declaredOperations !== i.operations.length ? [f(code('declared-operation-count-mismatch'))] : []), ...i.operations.filter(r => r.qubits.some(q => q >= i.qubitCount)).map(r => f(code('operand-outside-register'), r.id))], metrics: [m(code('supplied-operation-count'), 'circuit', i.operations.length)] }
    }),
  spec(prefix + 'record-sequence-diff', makeDescription('Distinguish inserted/removed/changed operations from shared-instruction reordering, preserving operand order and parameter units. Reordering is observed metadata, not proof of changed physics.'),
    input({ before: list(operation, 0, 32), after: list(operation, 0, 32) }), { before: [rotation], after: [rotation] }, { before: [rotation], after: [{ ...rotation, qubits: [1] }] },
    ['qcir-operation-changed', 'qcir-operation-removed', 'qcir-operation-added', 'qcir-shared-operation-order-changed'], ['qcir-operation-differences'], i => orderedDiff(i.before, i.after, 'qcir')),
  spec(prefix + 'provenance-edge-audit', makeDescription('Bind declared circuit transformation edges to exact parent/child operation digests and parent backend references. Transforms may change backends when explicitly pinned; cycles and duplicate edges do not count as valid lineage.'),
    input({ nodes: records(pins), edges: records({ childId: id, parentId: id, parentBackendRef: id, parentOperationsDigest: digest, childOperationsDigest: digest }) }),
    { nodes: [row, { ...row, id: 'parent' }], edges: [{ id: 'e1', childId: 'circuit1', parentId: 'parent', parentBackendRef: 'backend1', parentOperationsDigest: hash, childOperationsDigest: hash }] },
    { nodes: [row, { ...row, id: 'parent' }], edges: [{ id: 'e1', childId: 'circuit1', parentId: 'parent', parentBackendRef: 'backend1', parentOperationsDigest: otherHash, childOperationsDigest: hash }] },
    [code('lineage-pin-mismatch'), code('lineage-endpoint-missing'), code('lineage-cycle'), code('duplicate-lineage-edge')], [code('bound-transformation-edges')], i => {
      unique(i.nodes.map(r => r.id)); unique(i.edges.map(r => r.id)); const nodes = new Map(i.nodes.map(r => [r.id, r])), cyclic = edgeCycles(i.edges); let bound = 0
      const findings = i.edges.flatMap(e => { const p = nodes.get(e.parentId), c = nodes.get(e.childId), issues = [...(!p || !c ? [f(code('lineage-endpoint-missing'), e.id)] : []), ...(p && c && (p.backendRef !== e.parentBackendRef || p.operationsDigest !== e.parentOperationsDigest || c.operationsDigest !== e.childOperationsDigest) ? [f(code('lineage-pin-mismatch'), e.id)] : []), ...(cyclic(e.childId, e.parentId) ? [f(code('lineage-cycle'), e.id)] : []), ...(i.edges.filter(a => a.childId === e.childId && a.parentId === e.parentId).length > 1 ? [f(code('duplicate-lineage-edge'), e.id)] : [])]; if (!issues.length) bound++; return issues })
      return { findings, metrics: [m(code('bound-transformation-edges'), 'circuit', bound)] }
    }),
  spec(prefix + 'scope-boundary-audit', makeDescription('Compare supplied circuit backend/revision/scope labels and register sizes against an explicit permitted-backend frame. Matching labels do not grant execution authority.'),
    input({ permittedBackendRefs: list(id, 1, 16), permittedScopes: list(id, 1, 16), expectedRevision: digest, maximumQubits: qubitCount, rows: records(pins) }),
    { permittedBackendRefs: ['backend1'], permittedScopes: ['public-metadata'], expectedRevision: hash, maximumQubits: 2, rows: [row] },
    { permittedBackendRefs: ['backend1'], permittedScopes: ['public-metadata'], expectedRevision: hash, maximumQubits: 2, rows: [{ ...row, backendRef: 'backend2' }] },
    [code('backend-outside-scope'), code('revision-outside-scope'), code('label-outside-scope'), code('register-outside-scope')], [code('in-scope-circuits')], i => {
      unique(i.permittedBackendRefs); unique(i.permittedScopes); unique(i.rows.map(r => r.id)); let inside = 0
      const findings = i.rows.flatMap(r => { const issues = [...(!i.permittedBackendRefs.includes(r.backendRef) ? [f(code('backend-outside-scope'), r.id)] : []), ...(r.circuitRevision !== i.expectedRevision ? [f(code('revision-outside-scope'), r.id)] : []), ...(!i.permittedScopes.includes(r.scopeRef) ? [f(code('label-outside-scope'), r.id)] : []), ...(r.qubitCount > i.maximumQubits ? [f(code('register-outside-scope'), r.id)] : [])]; if (!issues.length) inside++; return issues }); return { findings, metrics: [m(code('in-scope-circuits'), 'circuit', inside)] }
    }),
  spec(prefix + 'export-semantic-parity', makeDescription('Compare parsed instruction exports preserving sequence, operand order, gate references and parameter values/units. Unlike an unordered manifest comparison, circuit instruction reordering is a difference. Not physical-equivalence checking.'),
    input({ before: list(operation, 0, 32), after: list(operation, 0, 32) }), { before: [rotation], after: [rotation] }, { before: [rotation], after: [{ ...rotation, qubits: [1] }] },
    [code('ordered-export-difference')], [code('export-operation-count-before'), code('export-operation-count-after')], i => {
      unique(i.before.map(r => r.id)); unique(i.after.map(r => r.id))
      return { findings: demandDigest(i.before) === demandDigest(i.after) ? [] : [f(code('ordered-export-difference'))], metrics: [m(code('export-operation-count-before'), 'circuit', i.before.length), m(code('export-operation-count-after'), 'circuit', i.after.length)] }
    }),
]
const base = recordAuditSuite({ category: 'quantum-circuit-records', noun: 'bounded backend/circuit/register/operation-pin records', boundary: quantumBoundary,
  pins, sample: row, owner: 'backendRef', subject: 'circuitRef', revision: 'circuitRevision', content: 'operationsDigest', units: ['radians', 'degrees'], unitMeaning: 'declared circuit parameter',
})
const byId = new Map(custom.map(s => [s.id, s]))
export const BATCH10_CIRCUITS = base.map(s => byId.get(s.id) ?? { ...s, description: s.description.replace('issuer/subject or producer/work pins', 'backend/circuit/register/operation pins') })
