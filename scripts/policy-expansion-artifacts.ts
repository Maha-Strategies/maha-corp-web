// Read-only deterministic generator. Apply an explicitly reviewed patch to create a freeze.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { policyCandidateMap, POLICY_POSITIONS } from '../lib/policy-expansion-map.ts'
import { POLICY_DRAFTS } from '../lib/policy-expansion-drafts.ts'
import { POLICY_SOURCES } from '../lib/policy-expansion-sources.ts'
import { validatePolicyDraft } from '../lib/policy-expansion-validation.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const digest = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex')
type Manifest = { pages: { path: string; canonicalUrl: string; canonicalHost: string; title: string; topic: string; routeRole: string; adoption: unknown }[] }
export function policyArtifacts() {
  POLICY_DRAFTS.forEach(validatePolicyDraft)
  const map = policyCandidateMap()
  const manifest: Manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/federation/implementations/maha-policy-pages-v2.json'), 'utf8'))
  const technical = manifest.pages.map(p => ({ url: p.canonicalUrl, canonicalOwner: p.canonicalHost, title: p.title, topic: p.topic, role: p.routeRole,
    reader: 'Technical definition / legal mechanism / implementation evidence; role-specific.',
    claimType: 'Role-specific: law, mechanism, evidence or comparison; not a new personal position.',
    review: 'Manifest inventory only. No fresh substantive review of this article in this sprint.',
    treatment: 'Preserve canonical URL; link from citizen-facing questions when relevant.',
  }))
  const proposals = POLICY_POSITIONS.filter(p => p.kind === 'existing-published-proposal').map(p => ({ url: `https://www.mahastrategies.com${p.provenance}`, canonicalOwner: 'www.mahastrategies.com', title: p.title, reader: 'Readers of existing Maha proposals', claimType: p.kind, review: p.approval, treatment: `Reuse; ${p.gap}` }))
  const relatedAssets = [
    { route: '/books/the-maha-principle', topic: 'Philosophical framework', reader: 'Book readers', claimType: 'Attributed values, not legislative commitments', review: 'Maintenance placeholder; public book text unavailable.', treatment: 'Retain attributed reference, not empirical support.' },
    { route: '/knowledge', topic: 'Knowledge discovery', reader: 'General and technical learners', claimType: 'Domain-specific explanations and evidence', review: 'Discovery surface inspected; child claims not re-reviewed.', treatment: 'Use discovery links, not inherited review status.' },
    { route: '/knowledge/maps/semiconductor-manufacturing-process-map', topic: 'Semiconductor manufacturing', reader: 'Technical learners', claimType: 'Technical process explanation', review: 'Local renderer, source lookup and declared citations inspected; not a fresh inspection of all source documents.', treatment: 'Reuse technical explanations; separately research industrial-policy costs and authority.' },
    { route: '/governed-workflow', topic: 'Agent governance', reader: 'Technical implementers and potential customers', claimType: 'Maha implementation and product claims', review: 'Existing local workflow page inspected; not independent assurance of policy effectiveness.', treatment: 'Disclose commercial interest; do not prescribe purchasing Maha services.' },
    { route: '/tools/evidence-preflight', topic: 'Evidence workflow', reader: 'Claim authors and evaluators', claimType: 'Structural tool capability, not substantive verification', review: 'Local page explicitly limits the tool to structural checks.', treatment: 'Reuse process concepts, not a claim that machine structure verifies facts.' },
  ]
  const inventory = { schemaVersion: 'maha-policy-inventory/1.0', asOf: '2026-09-19', scope: 'Five proposal pages, main hub and working paper, 300 technical manifest articles, and explicitly named adjacent assets. Not an exhaustive federation crawl.',
    counts: { technicalManifestArticles: technical.length, publishedProposals: proposals.length },
    observations: [
      { url: 'https://www.mahastrategies.com/policy', http: 200, canonical: 'https://www.mahastrategies.com/policy', scope: 'Read current page; five proposals and philosophical framing.' },
      { url: 'https://www.mahastrategies.com/policy/nutrient-density-standard', http: 200, canonical: 'https://www.mahastrategies.com/policy/nutrient-density-standard', scope: 'Read current proposal; directional, not costed.' },
      { url: 'https://policy.mahastrategies.com/', http: 200, canonical: 'https://policy.mahastrategies.com', scope: 'Read technical property entrance; not a fresh 300-article crawl.' },
      { url: 'https://policy.mahastrategies.com/policy/ai-agent-accountability/definition', http: 200, scope: 'Read bounded definition and its stated evidence; did not independently re-review all original sources.' },
      { url: 'https://www.mahastrategies.com/books/the-maha-principle', http: 200, canonical: 'https://www.mahastrategies.com', scope: 'Maintenance placeholder; inherited homepage canonical is a pre-existing issue, not repaired here.' },
    ],
    main: [{ url: 'https://www.mahastrategies.com/policy', canonicalOwner: 'www.mahastrategies.com', reader: 'General readers', claimType: 'Attributed proposals and philosophical values', treatment: 'Keep production intact; review the new entrance locally.' }, ...proposals,
      { url: 'https://www.mahastrategies.com/policy/nutrient-density-standard/paying-for-nutrition', canonicalOwner: 'www.mahastrategies.com', reader: 'Readers seeking a working-paper argument', claimType: 'Existing working paper, not an independent score', treatment: 'Preserve; refresh evidence before reusing claims.' }],
    related: relatedAssets.map(asset => ({ ...asset, canonicalOwner: 'www.mahastrategies.com', url: `https://www.mahastrategies.com${asset.route}`, explicitPageFile: fs.existsSync(path.join(root, 'app', asset.route, 'page.tsx')) })),
    technical,
    duplicationDecisions: map.questions.filter(q => q.existingEquivalent).map(q => ({ candidate: q.id, keepUrl: q.existingEquivalent, decision: q.semanticDecision })),
    gaps: ['Search Console demand not supplied for this sprint: unknown throughout.', 'The 300 manifest rows are not 300 newly inspected or newly verified live articles.', 'The Maha Principle public edition is unavailable; philosophy is not legislative approval.', 'Related assets are a focused inventory, not an exhaustive list of every overlapping book or knowledge page.'],
  }
  const readiness = { schemaVersion: 'maha-policy-readiness/1.0', asOf: '2026-09-19', counts: { answerDrafts: POLICY_DRAFTS.length, optionsBriefsForReview: POLICY_DRAFTS.filter(d => d.readiness === 'options-brief').length, currentBaselineHolds: POLICY_DRAFTS.filter(d => d.readiness === 'revise-current-baseline').length, sourcePackets: POLICY_SOURCES.length, publicationApproved: 0 },
    answers: POLICY_DRAFTS.map(d => ({ slug: d.slug, state: d.readiness, position: d.status, costs: d.costs.status, sources: d.sources, gaps: d.gaps, publicationApproved: false })), reviewBasis: 'AI-assisted drafting and source inspection; no independent expert/legal/budget review or personal position approval.',
    evidenceDigest: digest(POLICY_SOURCES), draftsDigest: digest(POLICY_DRAFTS),
  }
  return {
    'candidate-map.json': { ...map, freezeDigest: digest(map) },
    'inventory.json': inventory,
    'positions.json': { schemaVersion: 'maha-policy-positions/1.0', asOf: '2026-09-19', positions: POLICY_POSITIONS },
    'readiness.json': readiness,
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifacts = policyArtifacts()
  if (process.argv.includes('--check')) {
    for (const [name, body] of Object.entries(artifacts)) {
      const expected = JSON.stringify(body, null, 2) + '\n'
      if (fs.readFileSync(path.join(root, 'content/policy-expansion/v1', name), 'utf8') !== expected) throw new Error(`freeze-drift:${name}; explicit review and patch required, never silently overwrite`)
    }
    console.log('PASS: four frozen artifacts match deterministic regeneration. No files written.')
  } else if (process.argv.includes('--stdout')) {
    const requested = process.argv[process.argv.indexOf('--stdout') + 1]
    if (requested && !(requested in artifacts)) throw new Error('unknown-artifact')
    console.log(JSON.stringify(requested ? artifacts[requested as keyof typeof artifacts] : artifacts))
  }
  else throw new Error('Use --check or --stdout. This generator never overwrites a freeze.')
}
