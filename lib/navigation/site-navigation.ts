/**
 * The public navigation of mahastrategies.com.
 *
 * Kept as data rather than JSX so the one property that matters can be asserted
 * without rendering: a buyer evaluating Context Compiler, the Context-Control
 * Evidence Assessment, governance or orchestration is never one click from the
 * experimental and cultural work.
 *
 * That work is not removed, hidden or deindexed. Every route below still
 * resolves, is still crawlable, and is still reachable by direct link, from
 * search, from the sitemap, and from within its own section. What changes is
 * that the global chrome no longer offers it to someone who came to buy
 * infrastructure. See docs/navigation/enterprise-register-separation.md.
 */
export type NavigationLink = { name: string; href: string }

/**
 * Routes that belong to the experimental and cultural register.
 *
 * Named by prefix because the exclusion is about a whole section, not a landing
 * page: /doctrine/briefs/... is as much Register C as /doctrine.
 *
 * `/research` is here because its own document title is "Research & Doctrine"
 * and it is the biological-sovereignty landing page POSITIONING-FIX Task 1
 * names explicitly -- not because research is off-thesis. Its enterprise child
 * `/research/mcp` stays in navigation, which is why matching is prefix-based
 * with an explicit allowance below.
 */
export const REGISTER_C_PREFIXES = [
  '/doctrine',
  '/protocols',
  '/operations/timing',
  '/reports/celestial',
  '/knowledge/astrology',
  '/overclock',
  '/books',
  '/apps',
  '/research',
  '/start',
  '/software',
] as const

/**
 * Enterprise routes that sit underneath a Register C prefix.
 *
 * `/research/mcp` is the Cognitive Gateway page. It predates this separation
 * and moving it would break its inbound links for no gain, so it is allowed
 * through by exact path rather than relocated.
 */
export const ENTERPRISE_EXCEPTIONS = ['/research/mcp'] as const

export function isRegisterC(href: string): boolean {
  const path = href.split(/[?#]/)[0]
  if ((ENTERPRISE_EXCEPTIONS as readonly string[]).includes(path)) return false
  return REGISTER_C_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * The primary bar, ordered as a buyer moves: what it is, the evidence, the
 * control layer, how to build on it, then how to talk to someone.
 */
export const PRIMARY_NAVIGATION: readonly NavigationLink[] = [
  { name: 'Context Compiler', href: '/context-compiler' },
  { name: 'WSO2 Evaluation', href: '/integrations/wso2' },
  { name: 'Evidence Audit', href: '/evidence-audit' },
  { name: 'MCP Gateway', href: '/enterprise-mcp-gateway' },
  { name: 'Developers', href: '/developers' },
  { name: 'Contact', href: '/contact' },
] as const

/**
 * Width budget for the desktop bar, in label characters.
 *
 * The bar is capped at `max-w-6xl` and shares that line with the wordmark and
 * the Explore control. Product names are longer than the section names they
 * replaced -- "Context Compiler" against "Books" -- so a set that reads well in
 * a list can still wrap or collide in the chrome. At 11px mono with 0.08em
 * tracking the remaining room is roughly 819px; 73 characters across six items
 * lands near 740px. `Case Studies` moved to Explore for this reason, and is
 * still in the footer.
 */
export const PRIMARY_NAVIGATION_CHARACTER_BUDGET = 78

/**
 * Secondary navigation. Everything here is commercially supportable today:
 * a live surface, a published standard, or a documented tool.
 *
 * The orchestration control plane is deliberately absent. It is pilot-grade by
 * its own documentation -- no OIDC, one storage backend, no DR exercise -- and
 * has no public page, so listing it would advertise something a buyer cannot
 * yet evaluate.
 */
export const EXPLORE_NAVIGATION: readonly NavigationLink[] = [
  { name: 'Method', href: '/method' },
  { name: 'Case Studies', href: '/case-studies' },
  { name: 'MPS Standard', href: '/mps' },
  { name: 'Live Auditor', href: '/audit' },
  { name: 'MPS Preflight', href: '/mps/preflight' },
  { name: 'API Documentation', href: '/docs' },
  { name: 'Try Context Compiler', href: '/context-compiler/playground' },
  { name: 'Context Pack Evaluator', href: '/context-pack-evaluator' },
  { name: 'Cognitive Gateway', href: '/research/mcp' },
  { name: 'x402 Conformance Observatory', href: '/x402-observatory' },
  { name: 'x402 Buyer Policy', href: '/x402-buyer-policy' },
  { name: 'Maha Navigator', href: '/navigator' },
  { name: 'Tools & API', href: '/tools' },
  { name: 'Intelligence', href: '/intelligence' },
  { name: 'Knowledge', href: '/knowledge' },
  { name: 'Insights', href: '/insights' },
  { name: 'Policy', href: '/policy' },
  { name: 'About Maha', href: '/about' },
] as const

export const FOOTER_DEVELOPER_NAVIGATION: readonly NavigationLink[] = [
  { name: 'Developer infrastructure', href: '/developers' },
  { name: 'API documentation', href: '/docs' },
  { name: 'Context Compiler', href: '/context-compiler' },
  { name: 'WSO2 Gateway integration', href: '/integrations/wso2' },
  { name: 'Enterprise MCP Gateway', href: '/enterprise-mcp-gateway' },
  { name: 'Try Context Compiler', href: '/context-compiler/playground' },
  { name: 'x402 Conformance Observatory', href: '/x402-observatory' },
  { name: 'x402 Buyer Policy', href: '/x402-buyer-policy' },
] as const

export const FOOTER_COMPANY_NAVIGATION: readonly NavigationLink[] = [
  { name: 'Method', href: '/method' },
  { name: 'Evidence Audit', href: '/evidence-audit' },
  { name: 'Case studies', href: '/case-studies' },
  { name: 'Knowledge', href: '/knowledge' },
  { name: 'Intelligence', href: '/intelligence' },
  { name: 'MPS Preflight', href: '/mps/preflight' },
  { name: 'About Maha', href: '/about' },
  { name: 'Contact', href: '/contact' },
] as const

/** Every link the global chrome renders, for assertion in one place. */
export const ALL_GLOBAL_NAVIGATION: readonly NavigationLink[] = [
  ...PRIMARY_NAVIGATION,
  ...EXPLORE_NAVIGATION,
  ...FOOTER_DEVELOPER_NAVIGATION,
  ...FOOTER_COMPANY_NAVIGATION,
] as const

/**
 * Where the one permitted author-brand link already lives.
 *
 * POSITIONING-FIX Task 1 allows exactly one link from this domain to the
 * author brand, in the footer *or* an About-page bio. The About page already
 * carries it, and that anchor is `rel="me"` and referenced by the entity
 * graph, so it is the load-bearing one. This separation therefore adds no new
 * author-brand link -- adding a footer note would have made a second.
 *
 * `/contact` also links to the author brand today. Consolidating that is a
 * copy decision rather than a navigation one and is left open; it is recorded
 * in docs/navigation/enterprise-register-separation.md.
 */
export const AUTHOR_BRAND_CANONICAL_SURFACE = 'app/about/page.tsx' as const
