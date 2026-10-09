import { z } from 'zod'
import { calculatePolicyVariables } from './policy-simulation.ts'
import { CIVIC_SOURCE_ARCHIVES } from './source-archives.ts'
import { civicDigest, civicIdSchema, digestSchema, immutableSnapshot, sourceUrlSchema } from './receipt.ts'

export const policyNodeSchema = z.object({
  id: civicIdSchema,
  title: z.string().min(5).max(120),
  category: z.enum(['monetary-reform', 'ai-governance', 'energy-grid', 'healthcare-transparency', 'anti-corruption', 'constitutional-sovereignty']),
  summary: z.string().max(1000),
  primaryLegislativeSources: z.array(z.object({
    citation: z.string().min(1).max(300),
    url: sourceUrlSchema,
    // Optional digest must refer to archived source bytes, never just the URL.
    digest: digestSchema.optional(),
  }).strict()).min(1).max(30),
  economicVariables: z.array(z.object({
    name: z.string().min(1).max(120),
    baselineValue: z.number().finite(),
    projectedImpactDelta: z.number().finite(),
    unit: z.string().min(1).max(60),
    confidenceInterval: z.tuple([z.number().finite(), z.number().finite()]),
  }).strict().refine(v => v.confidenceInterval[0] <= v.projectedImpactDelta && v.projectedImpactDelta <= v.confidenceInterval[1],
    'The ordered impact bounds must contain the projected delta.')).max(50),
  tradeoffsAndDownsides: z.array(z.string().min(1).max(500)).min(1).max(30),
  evidenceBasis: z.string().min(1).max(2000),
}).strict().refine(node => new Set(node.economicVariables.map(v => v.name)).size === node.economicVariables.length,
  'Economic variable names must be unique.')

export type PolicyNode = z.infer<typeof policyNodeSchema>

export function computePolicyDigest(node: PolicyNode): string {
  return civicDigest(policyNodeSchema.parse(node))
}

export const INITIAL_POLICY_REGISTRY: readonly PolicyNode[] = immutableSnapshot([policyNodeSchema.parse({
  id: 'epistemic-procurement-transparency',
  title: 'Zero-Trust Federal Software Procurement & Epistemic Auditing',
  category: 'anti-corruption',
  summary: 'Proposal: mandate open-source verification and machine-readable execution logs for federal IT contracts exceeding $10M.',
  primaryLegislativeSources: [{
    citation: '41 U.S.C. § 3301 — Full and open competition (2023 edition; legislative context)',
    url: 'https://www.govinfo.gov/content/pkg/USCODE-2023-title41/pdf/USCODE-2023-title41-subtitleI-divsnC-chap33.pdf',
    digest: CIVIC_SOURCE_ARCHIVES[0].digest,
  }],
  economicVariables: [{
    name: 'Annual Federal IT Waste Reduction', baselineValue: 100, projectedImpactDelta: -38.5,
    unit: 'Billion USD', confidenceInterval: [-45, -30],
  }],
  tradeoffsAndDownsides: ['Initial compliance friction for legacy defense contractors', 'Requires federal hiring of software engineers', 'Disclosure needs security, privacy and intellectual-property safeguards'],
  evidenceBasis: 'Illustrative inputs supplied in the 2026 task specification (Maha Strategies algorithmic audit model 2026.1). No empirical calibration or independent scoring supplied. The 100 baseline, -38.5 delta and [-45, -30] bounds are assumptions, not measured waste or a statistical confidence interval. The cited statute provides competition context; it does not establish this proposal or these savings.',
})])

export const policyEdgeSchema = z.object({
  from: civicIdSchema,
  to: civicIdSchema,
  relationship: z.enum(['depends-on', 'supports', 'conflicts-with']),
  rationale: z.string().min(1).max(500),
}).strict()

export const policyGraphSchema = z.object({
  nodes: z.array(policyNodeSchema).min(1).max(100),
  edges: z.array(policyEdgeSchema).max(500),
}).strict().superRefine((graph, ctx) => {
  const ids = new Set(graph.nodes.map(n => n.id))
  if (ids.size !== graph.nodes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate policy IDs.' })
  const edges = new Set<string>()
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) ctx.addIssue({ code: 'custom', message: 'Edge has missing or identical endpoints.' })
    const key = `${edge.from}:${edge.relationship}:${edge.to}`
    if (edges.has(key)) ctx.addIssue({ code: 'custom', message: 'Duplicate graph edge.' })
    edges.add(key)
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  function visit(id: string): boolean {
    if (visiting.has(id)) return false
    if (visited.has(id)) return true
    visiting.add(id)
    for (const edge of graph.edges.filter(e => e.from === id && e.relationship === 'depends-on')) if (!visit(edge.to)) return false
    visiting.delete(id); visited.add(id)
    return true
  }
  if (graph.nodes.some(n => !visit(n.id))) ctx.addIssue({ code: 'custom', message: 'Policy dependencies must be acyclic.' })
})

export type PolicyGraph = z.infer<typeof policyGraphSchema>
export const INITIAL_POLICY_GRAPH: PolicyGraph = immutableSnapshot(policyGraphSchema.parse({ nodes: INITIAL_POLICY_REGISTRY, edges: [] }))

export const simulationInputSchema = z.object({
  policyId: civicIdSchema,
  adoptionRate: z.number().finite().min(0).max(1),
  // Rate is an assumption; optional overrides let analysts examine a new baseline.
  baselineOverrides: z.record(z.string(), z.number().finite()).default({}),
  impactOverrides: z.record(z.string(), z.number().finite()).default({}),
}).strict()
export type SimulationInput = z.input<typeof simulationInputSchema>

/** Executable dependency graph; impacts are not summed across unrelated units. */
export function simulatePolicy(input: SimulationInput, graph: PolicyGraph = INITIAL_POLICY_GRAPH) {
  const scenario = simulationInputSchema.parse(input)
  const parsed = policyGraphSchema.parse(graph)
  const policy = parsed.nodes.find(n => n.id === scenario.policyId)
  if (!policy) throw new Error('Unknown policy ID.')
  const order: string[] = []
  function visit(id: string) {
    if (order.includes(id)) return
    for (const edge of parsed.edges.filter(e => e.from === id && e.relationship === 'depends-on')) visit(edge.to)
    order.push(id)
  }
  visit(policy.id)
  const payload = {
    version: 'civic-simulation-1' as const,
    policyId: policy.id,
    policyDigest: computePolicyDigest(policy),
    graphDigest: civicDigest(parsed),
    scenario,
    executionOrder: order,
    dependencies: order.filter(id => id !== policy.id),
    conflicts: parsed.edges.filter(e => e.relationship === 'conflicts-with' && (order.includes(e.from) || order.includes(e.to))),
    evidenceStatus: 'illustrative-unvalidated' as const,
    model: 'baseline + adoptionRate × assumed impact delta; linear sensitivity, no causal inference',
    variables: calculatePolicyVariables(policy, scenario),
    sources: policy.primaryLegislativeSources,
    evidenceBasis: policy.evidenceBasis,
    tradeoffs: policy.tradeoffsAndDownsides,
    limitations: ['These are supplied assumptions, not predicted outcomes.', 'Bounds have no specified statistical confidence level.', 'Costs, interactions, timing and implementation failures are not modeled.', 'Dependency order records prerequisites; it does not prove enactment or model their impacts.'],
  }
  return immutableSnapshot({ ...payload, digest: civicDigest(payload) })
}
export type SimulationReceipt = ReturnType<typeof simulatePolicy>
