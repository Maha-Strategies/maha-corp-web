import policyManifest from '../content/federation/implementations/maha-policy-pages-v2.json' with { type: 'json' }
import type { FederationPage } from './federation-publication'

export const POLICY_SITE_URL = 'https://policy.mahastrategies.com'
export const POLICY_FRONT_DOOR_DATE = '2026-09-08'

export const POLICY_TOPICS = [
  { label: 'AI accountability', slug: 'ai-agent-accountability', description: 'Responsibility, traceability, and institutional accountability for agentic systems.' },
  { label: 'Agent governance', slug: 'automated-decision-governance', description: 'Controls, oversight, and decision boundaries for automated systems.' },
  { label: 'Evidence policy', slug: 'scientific-evidence-policy', description: 'How evidence is scoped, evaluated, and carried into policy decisions.' },
  { label: 'Identity', slug: 'agent-identity', description: 'Workload identity, human identity, delegation, and the limits between them.' },
  { label: 'Auditability', slug: 'auditability', description: 'Records, receipts, observability, and the evidence needed to reconstruct decisions.' },
  { label: 'Standards', slug: 'standards-and-conformity', description: 'Standards, conformity claims, assurance, and authority boundaries.' },
  { label: 'Privacy', slug: 'data-protection', description: 'Data protection duties, operational controls, and jurisdictional limits.' },
  { label: 'Semiconductor policy', slug: 'semiconductor-policy', description: 'Industrial policy, capacity, resilience, and the separation of funding from outcomes.' },
] as const

export const POLICY_DISCOVERY_GROUPS = [
  { slug: 'definitions', label: 'Definitions', roles: ['definition'], description: 'Canonical, source-bounded meanings and the adjacent concepts they do not silently absorb.' },
  { slug: 'current-law', label: 'Current law', roles: ['current-law'], description: 'Dated, jurisdiction-specific summaries that remain informational and do not replace legal advice.' },
  { slug: 'mechanisms', label: 'Mechanisms', roles: ['mechanisms'], description: 'How a policy instrument or governance control is intended to work, separated from measured outcomes.' },
  { slug: 'implementation', label: 'Implementation', roles: ['implementation'], description: 'Operational steps, controls, refusal conditions, and evidence requirements.' },
  { slug: 'machine-rules', label: 'Machine rules', roles: ['machine-rule'], description: 'Executable or machine-readable constraints, published only where the rule is genuinely specified.' },
  { slug: 'evidence', label: 'Evidence', roles: ['evidence'], description: 'Claim-specific evidence assessments with exact sources, locators, rights, scope, and boundaries.' },
  { slug: 'tradeoffs-and-uncertainty', label: 'Trade-offs & uncertainty', roles: ['tradeoffs', 'uncertainty'], description: 'Known costs, unresolved evidence, model limits, and future-change risk.' },
] as const

export type PolicyDiscoverySlug = (typeof POLICY_DISCOVERY_GROUPS)[number]['slug']

export const POLICY_FEDERATION_LINKS = [
  { label: 'Research: evidence graph definition', href: 'https://research.mahastrategies.com/federation/research/evidence-graph/definition', description: 'The research-layer definition behind evidence relationships and provenance.' },
  { label: 'Publish: editorial review governance', href: 'https://publish.mahastrategies.com/agentic-publishing/editorial-review/governance', description: 'How reviewed material moves through an agentic publishing workflow.' },
  { label: 'Maha OS: device identity controls', href: 'https://www.maha-os.com/knowledge/private-machine-systems/device-identity/controls', description: 'A product-layer application of identity and control boundaries.' },
] as const

export const POLICY_COMMERCIAL_LINKS = [
  { label: 'Free Evidence Preflight', href: 'https://www.mahastrategies.com/tools/evidence-preflight', description: 'Check up to three claims without creating a verified dossier.' },
  { label: '$49 MPS Document Preflight', href: 'https://www.mahastrategies.com/mps/preflight', description: 'Run a private, bounded document-level preflight.' },
  { label: '$250 Verified Evidence Dossier', href: 'https://www.mahastrategies.com/evidence-audit', description: 'Commission a governed evidence review with an explicit delivery boundary.' },
] as const

const pages = (policyManifest as unknown as { pages: FederationPage[] }).pages
if (pages.length !== 300) throw new Error(`policy-front-door-manifest-cardinality:${pages.length}`)

export const POLICY_PAGES = Object.freeze([...pages].sort((left, right) => left.title.localeCompare(right.title)))

export function policyDiscoveryGroup(slug: string) {
  return POLICY_DISCOVERY_GROUPS.find((group) => group.slug === slug) ?? null
}

export function policyPagesForDiscovery(slug: string) {
  const group = policyDiscoveryGroup(slug)
  if (!group) return []
  const roles = new Set<string>(group.roles)
  return POLICY_PAGES.filter((page) => roles.has((page as FederationPage & { routeRole?: string }).routeRole ?? page.path.split('/').at(-1) ?? ''))
}

export function policyTopicDefinitionUrl(slug: string) {
  return `${POLICY_SITE_URL}/policy/${slug}/definition`
}

export function policyFrontDoorSitemapRows() {
  const lastModified = new Date(POLICY_FRONT_DOOR_DATE)
  return [
    { url: POLICY_SITE_URL, lastModified },
    ...POLICY_DISCOVERY_GROUPS.map((group) => ({ url: `${POLICY_SITE_URL}/discover/${group.slug}`, lastModified })),
  ]
}
