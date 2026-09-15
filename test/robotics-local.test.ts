import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROBOTICS_ARTICLES, ROBOTICS_SOURCES, roboticsCandidateMap, roboticsCandidateFreezeV1 } from '../lib/robotics-knowledge.ts'
import { canonical, generateRoboticsPackage, roboticsDigest, verifyRoboticsPackage } from '../lib/robotics-evidence.ts'

test('40 distinct topics, 38 written guides, 2 prototypes; original selection preserved', () => {
  const map = roboticsCandidateMap()
  assert.equal(map.length, 40); assert.equal(new Set(map.map(a => a.slug)).size, 40)
  const frozen = roboticsCandidateFreezeV1()
  assert.equal(roboticsDigest(frozen), 'sha256:44e1826b72ae7e8df5017ac4e202147ecbe447cb0478564977b9030c1909b070', 'historical freeze must remain unchanged')
  assert.deepEqual(map.map(a => a.slug), frozen.map(a => a.slug))
  assert.equal(ROBOTICS_ARTICLES.length, 38)
  assert.equal(map.filter(a => a.status === 'local-prototype').length, 2)
  assert.equal(map.filter(a => a.status === 'local-draft').length, 38)
  assert.ok(map.every(a => a.demand === 'unknown'))
  const counts = Object.fromEntries(['foundations', 'evaluation', 'provenance', 'assistance', 'governance', 'examples'].map(g => [g, map.filter(a => a.group === g).length]))
  assert.deepEqual(counts, { foundations: 8, evaluation: 10, provenance: 8, assistance: 6, governance: 4, examples: 4 })
  for (const a of map) {
    const visited = new Set([a.slug]); let dep = a.dependency
    while (dep) { assert.ok(!visited.has(dep)); visited.add(dep); const parent = map.find(x => x.slug === dep); assert.ok(parent); dep = parent.dependency }
  }
})
test('sources, limits and related destinations exist for every guide', () => {
  for (const a of ROBOTICS_ARTICLES) {
    assert.ok(a.answer && a.explanation && a.example && a.boundary && a.procedure.length)
    for (const id of a.sources) { const s = ROBOTICS_SOURCES[id]; assert.ok(s.locator && s.rights && s.boundary) }
    for (const slug of a.related) assert.ok(roboticsCandidateMap().some(x => x.slug === slug))
  }
})
test('distinct original content and complete evidence fields, not title-only expansion', () => {
  for (const field of ['title', 'answer', 'explanation', 'example', 'boundary'] as const) {
    assert.equal(new Set(ROBOTICS_ARTICLES.map(a => a[field])).size, 38)
  }
  for (const a of ROBOTICS_ARTICLES) {
    assert.ok(a.procedure.length >= 3)
    assert.ok(a.sources.length > 0)
    assert.ok(a.related.length >= 2)
    assert.match(a.answer + ' ' + a.explanation, /Maha|proposed/, a.slug)
  }
  for (const slug of ['rosbag-intake-example', 'lerobot-intake-example']) {
    const a = ROBOTICS_ARTICLES.find(a => a.slug === slug)!
    assert.match(a.boundary, /No |not an operational/)
    assert.match(a.example, /[Ss]ynthetic/)
  }
})
test('reproduction retains all trials and assistance separately from autonomous success', () => {
  const a = generateRoboticsPackage(), b = generateRoboticsPackage()
  assert.deepEqual(a, b); assert.equal(verifyRoboticsPackage(a).verdict, 'verified-synthetic-replay')
  assert.equal(a.trials.length, 12)
  assert.deepEqual(a.metrics.map(m => [m.autonomous, m.assisted, m.failed, m.planned]), [[2, 1, 3, 6], [3, 1, 2, 6]])
  assert.ok(a.trials.filter(t => t.outcome === 'assisted').every(t => t.events.some(e => e.type === 'simulated-operator-assistance')))
})
type Package = ReturnType<typeof generateRoboticsPackage>
const mutations: [string, (p: Package) => void][] = [
  ['omitted trial', p => { p.trials.pop() }],
  ['duplicated trial', p => { p.trials[1] = p.trials[0] }],
  ['inflated success', p => { p.metrics[0].autonomous++ }],
  ['assistance hidden', p => { p.trials[3].events = p.trials[3].events.filter(e => e.type !== 'simulated-operator-assistance') }],
  ['controller changed', p => { p.artifacts.controllers[0].digest = 'sha256:wrong' }],
  ['physical claim', p => { p.domain = 'hardware' }],
  ['plan rewritten', p => { p.plan.cases.pop(); p.planDigest = roboticsDigest(p.plan) }],
  ['trial order changed', p => { p.trials.reverse() }],
]
for (const [name, mutate] of mutations) test(`refuses ${name}, even after rehashing`, () => {
  const p = generateRoboticsPackage(); mutate(p)
  const { packageDigest: ignored, ...body } = p; void ignored
  p.packageDigest = roboticsDigest(body)
  assert.equal(verifyRoboticsPackage(p).verdict, 'refused')
})
test('unknown fields and invalid JSON cannot pass', () => {
  assert.equal(verifyRoboticsPackage({ ...generateRoboticsPackage(), unexpected: 'private data' }).verdict, 'refused')
  for (const x of [undefined, NaN, Infinity, new Date(), { x: undefined }, 'x'.repeat(250_001)]) assert.equal(verifyRoboticsPackage(x).verdict, 'refused')
})
test('object key ordering does not change canonical identity', () => {
  assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 }))
  const p = generateRoboticsPackage()
  assert.equal(verifyRoboticsPackage(Object.fromEntries(Object.entries(p).reverse())).verdict, 'verified-synthetic-replay')
})
