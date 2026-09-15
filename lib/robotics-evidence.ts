import { createHash } from 'node:crypto'

export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}'
  }
  throw new Error('unsupported-json-value')
}
export const roboticsDigest = (value: unknown) => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex')
type Point = [number, number]
type Scenario = { id: string; target: Point; obstacles: Point[]; graspFails: boolean; assistance: boolean; maxActions: number }
export type Controller = 'direct-v1' | 'search-v2'
const CONTROLLERS: Controller[] = ['direct-v1', 'search-v2']
export function roboticsPlan() {
  const cases: Scenario[] = [
    { id: 'clear', target: [4, 0], obstacles: [], graspFails: false, assistance: false, maxActions: 12 },
    { id: 'detour', target: [4, 0], obstacles: [[2, 0]], graspFails: false, assistance: false, maxActions: 12 },
    { id: 'grasp-failure', target: [4, 0], obstacles: [], graspFails: true, assistance: false, maxActions: 12 },
    { id: 'assisted', target: [4, 0], obstacles: [], graspFails: false, assistance: true, maxActions: 12 },
    { id: 'budget', target: [4, 0], obstacles: [], graspFails: false, assistance: false, maxActions: 2 },
    { id: 'offset-target', target: [3, 2], obstacles: [], graspFails: false, assistance: false, maxActions: 12 },
  ]
  return { version: 'maha-grid-task/0.1', domain: 'toy-simulation', frame: 'fixed-grid', units: 'cells-and-discrete-ticks',
    initial: [0, 0], bounds: [5, 3], controllers: CONTROLLERS.slice(), cases,
    scoring: 'autonomous = released-at-target-without-assistance; all-six-planned-cases-per-controller',
    omitted: ['physics', 'perception', 'contact-forces', 'human-subjects', 'hardware', 'real-time-control'] }
}
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1]
function pathFor(s: Scenario, controller: Controller): Point[] {
  if (controller === 'direct-v1') {
    const path: Point[] = []
    for (let x = 1; x <= s.target[0]; x++) path.push([x, 0])
    for (let y = 1; y <= s.target[1]; y++) path.push([s.target[0], y])
    return path
  }
  const queue: Point[][] = [[[0, 0]]], visited = new Set(['0,0'])
  const neighbors: Point[] = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  while (queue.length) {
    const path = queue.shift()!, last = path[path.length - 1]
    if (same(last, s.target)) return path.slice(1)
    for (const [dx, dy] of neighbors) {
      const p: Point = [last[0] + dx, last[1] + dy]
      if (p[0] < 0 || p[0] >= 5 || p[1] < 0 || p[1] >= 3 || visited.has(p.join(',')) || s.obstacles.some(o => same(o, p))) continue
      visited.add(p.join(',')); queue.push([...path, p])
    }
  }
  return []
}
export type Event = { tick: number; type: string; position: Point; holding: boolean }
function simulate(s: Scenario, controller: Controller) {
  const events: Event[] = []
  let position: Point = [0, 0], holding = false, actions = 0
  const emit = (type: string) => events.push({ tick: events.length, type, position: [...position], holding })
  const finish = (outcome: 'autonomous' | 'assisted' | 'failed', reason: string) => ({ id: `${controller}/${s.id}`, controller, caseId: s.id, outcome, reason, actions, events })
  emit('start')
  actions++; holding = !s.graspFails; emit(holding ? 'grasp' : 'grasp-failed')
  if (!holding) return finish('failed', 'grasp-failed')
  if (s.assistance) emit('simulated-operator-assistance')
  const path = pathFor(s, controller)
  if (!path.length && !same(position, s.target)) { emit('no-path'); return finish('failed', 'no-path') }
  for (const next of path) {
    if (actions >= s.maxActions) { emit('timeout'); return finish('failed', 'action-budget') }
    actions++
    if (s.obstacles.some(o => same(o, next))) { emit('blocked-cell'); return finish('failed', 'blocked-cell') }
    position = next; emit('move')
  }
  if (actions >= s.maxActions) { emit('timeout'); return finish('failed', 'action-budget') }
  actions++; holding = false; emit('release')
  return finish(s.assistance ? 'assisted' : 'autonomous', 'released-at-target')
}

export function generateRoboticsPackage() {
  const plan = roboticsPlan()
  const trials = CONTROLLERS.flatMap(controller => plan.cases.map(s => simulate(s, controller)))
  const metrics = CONTROLLERS.map(controller => {
    const rows = trials.filter(t => t.controller === controller)
    const autonomous = rows.filter(t => t.outcome === 'autonomous').length
    return { controller, planned: plan.cases.length, recorded: rows.length, autonomous,
      assisted: rows.filter(t => t.outcome === 'assisted').length,
      failed: rows.filter(t => t.outcome === 'failed').length,
      autonomousRate: { numerator: autonomous, denominator: plan.cases.length } }
  })
  const artifacts = { simulator: roboticsDigest({ source: [pathFor.toString(), simulate.toString(), same.toString()], version: 'grid-simulator/0.1' }),
    controllers: CONTROLLERS.map(id => ({ id, digest: roboticsDigest({ id, implementation: pathFor.toString() }) })) }
  const body = { schema: 'maha-robotics-evidence/0.1', domain: 'toy-simulation', plan, planDigest: roboticsDigest(plan),
    artifacts, trials, metrics, observer: 'same-process-simulator-not-independent',
    rights: 'Maha-authored synthetic fixtures; no personal or third-party episode data',
    review: 'automated-consistency-check-not-robotics-expert-review',
    limitations: ['No physical robot tested', 'No physics or perception validation', 'No population generalization', 'No safety certification', 'No ROS or LeRobot adapter implemented'] }
  return { ...body, packageDigest: roboticsDigest(body) }
}

/** Only this fixed, versioned synthetic experiment is supported. No generic robot attestation. */
export function verifyRoboticsPackage(input: unknown) {
  try {
    const serialized = canonical(input)
    if (serialized.length > 250_000) return { verdict: 'refused', reason: 'package-too-large' } as const
    const expected = generateRoboticsPackage()
    if (serialized !== canonical(expected)) return { verdict: 'refused', reason: 'does-not-match-trusted-plan-and-replay' } as const
    return { verdict: 'verified-synthetic-replay', packageDigest: expected.packageDigest, physicalSafety: 'not-assessed' } as const
  } catch { return { verdict: 'refused', reason: 'invalid-json-value' } as const }
}

export function roboticsSummary() {
  const pkg = generateRoboticsPackage()
  return { schema: pkg.schema, packageDigest: pkg.packageDigest, planDigest: pkg.planDigest,
    metrics: pkg.metrics, verdict: verifyRoboticsPackage(pkg), limitations: pkg.limitations }
}
