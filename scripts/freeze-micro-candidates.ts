import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { X402_OFFERS } from '../lib/x402/offers.ts'
import { microDigest } from '../lib/x402/micro-products.ts'

const groups = {
  scientific: ['Unit conversion with uncertainty', 'Covariance-aware uncertainty propagation', 'Weighted calibration fit', 'Measurement compatibility check', 'Significant-figure reporting', 'Missing-data diagnostics', 'Sampling/Nyquist check', 'Coordinate-frame transformation', 'Bounded spectral analysis', 'Numerical convergence assessment'],
  mathematics: ['Exact linear-system solver', 'Matrix rank and null-space certificate', 'Polynomial factorization', 'Polynomial identity check', 'Rational-expression simplification with excluded values', 'Bracketed root-finding receipt', 'Interval-bound evaluation', 'Finite probability calculation', 'Graph connectivity/path analysis', 'Bounded linear-program solution with feasibility checks'],
  religion: ['Divine-name disambiguation', 'Edition-specific verse-reference resolution', 'Cross-edition passage alignment', 'Translation-variant comparison', 'Divine-epithet concordance', 'Landscape-deity relationship lookup', 'Place-name disambiguation', 'Primary-text versus commentary attribution', 'Documented reception-lineage retrieval', 'Cross-tradition comparison with explicit relationship types'],
  policy: ['Version-pinned policy-clause retrieval', 'Policy-version change comparison', 'Obligation-to-control mapping', 'Jurisdiction/date applicability triage', 'Control-evidence gap analysis', 'Responsibility-assignment consistency', 'Policy-exception validation', 'Declared data-flow boundary checks', 'Standard-to-standard control crosswalks', 'Policy-as-code evaluation against approved rules'],
  astronomy: ['Time-scale conversion', 'Julian-date conversion', 'Celestial-coordinate transformation', 'Angular-separation calculation', 'Proper-motion propagation', 'Altitude/azimuth conversion', 'Observing-window calculation', 'Uncertainty-aware positional crossmatching', 'Calendar/reference-convention comparison', 'Bounded statistical evaluation of a previously frozen experiment'],
  infrastructure: ['MCP contract compatibility', 'Tool-argument validation', 'Permission-change analysis', 'Workflow dependency validation', 'Provenance-graph integrity', 'Entity resolution across Maha properties', 'Claim-to-citation coverage', 'Citation-style conversion preserving locators', 'Machine-license scope matching', 'Publication-bundle consistency across article, registry and API'],
}
const candidates = Object.entries(groups).flatMap(([family, titles], group) => titles.map((title, i) => ({ candidateId: `micro60-${String(group * 10 + i + 1).padStart(2, '0')}`, family, title, demand: null, demandBasis: 'not-measured', cloudCost: null })))
const file = resolve(import.meta.dirname, '../content/discovery/micro-candidate-freeze-v1.json')
const args = process.argv.slice(2)
if (args.length !== 1 || !['--create', '--check'].includes(args[0])) throw new Error('Use --create once or --check; no remote mode')
if (args[0] === '--create') {
  const body = { version: 'micro-candidate-freeze/1', baseCommit: 'c06fd549', selectionPerformed: false, candidates,
    existingOffers: X402_OFFERS.map(o => ({ id: o.id, path: o.path, amount: o.amount, description: o.description, status: o.status })) }
  writeFileSync(file, JSON.stringify({ ...body, digest: microDigest(body) }, null, 2) + '\n', { flag: 'wx' })
} else {
  const { digest, ...body } = JSON.parse(readFileSync(file, 'utf8'))
  if (digest !== microDigest(body) || microDigest(body.candidates) !== microDigest(candidates) || body.existingOffers.length !== 24) throw new Error('freeze-mismatch')
}
console.log('60 candidates frozen; original 24-offer snapshot preserved. No selection, network or build.')
