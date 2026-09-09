import { microDigest } from './micro-products.ts'
import { convert, linear, bisect, covariance } from './micro-next-numerics.ts'
import type { NextProductId } from './micro-next-contracts.ts'

type Row = Record<string, unknown>
const sorted = (v: string[]) => [...v].sort()
const unique = (rows: Row[], field: string) => { if (new Set(rows.map(r => r[field])).size !== rows.length) throw new Error('duplicate-identity') }
const keyed = (rows: Row[], field: string) => { unique(rows, field); return new Map(rows.map(r => [r[field] as string, r])) }

export async function buildNextProduct(id: NextProductId, input: Row): Promise<Row> {
  switch (id) {
    case 'unit-uncertainty-conversion': return convert(input)
    case 'exact-linear-system': return linear(input.matrix as string[][], input.rhs as string[])
    case 'bracketed-polynomial-root': return bisect(input)
    case 'covariance-uncertainty': return covariance(input)
    case 'divine-name-disambiguation': case 'edition-verse-resolution': case 'reception-lineage-retrieval': {
      const { religionProduct } = await import('./micro-next-religion.ts')
      return religionProduct(id, input)
    }
    case 'policy-version-comparison': {
      if (input.beforeVersion === input.afterVersion || (input.beforeSequence as number) >= (input.afterSequence as number)) throw new Error('invalid-declared-order')
      const before = keyed(input.before as Row[], 'clauseId'), after = keyed(input.after as Row[], 'clauseId')
      if ([...before.values(), ...after.values()].some(r => !(r.text as string).trim())) throw new Error('empty-clause')
      return { policyId: input.policyId, beforeDigest: microDigest({ policyId: input.policyId, version: input.beforeVersion, sequence: input.beforeSequence, clauses: sorted([...before.keys()]).map(k => before.get(k)) }),
        afterDigest: microDigest({ policyId: input.policyId, version: input.afterVersion, sequence: input.afterSequence, clauses: sorted([...after.keys()]).map(k => after.get(k)) }),
        added: sorted([...after.keys()].filter(k => !before.has(k))), removed: sorted([...before.keys()].filter(k => !after.has(k))),
        changed: sorted([...before.keys()].filter(k => after.has(k))).map(k => ({ clauseId: k, fields: ['text', 'scope'].filter(f => before.get(k)![f] !== after.get(k)![f]) })).filter(c => c.fields.length), legalEffectDetermined: false }
    }
    case 'control-evidence-gaps': {
      const requirements = keyed(input.requirements as Row[], 'controlId'), evidence = input.evidence as Row[]
      unique(evidence, 'evidenceId')
      return { policyDigest: input.policyDigest, results: sorted([...requirements.keys()]).map(controlId => {
        const needed = requirements.get(controlId)!, candidates = evidence.filter(e => e.controlId === controlId)
        const matching = candidates.filter(e => e.policyDigest === input.policyDigest && e.contentDigest === needed.requiredContentDigest && e.scope === needed.scope && e.status === 'accepted')
        return { controlId, state: matching.length ? 'declared-match' : 'gap', matchingEvidenceIds: sorted(matching.map(e => e.evidenceId as string)), rejectedEvidenceIds: sorted(candidates.filter(e => !matching.includes(e)).map(e => e.evidenceId as string)) }
      }), orphanEvidenceIds: sorted(evidence.filter(e => !requirements.has(e.controlId as string)).map(e => e.evidenceId as string)), effectivenessVerified: false, complianceCertified: false }
    }
    case 'mcp-contract-compatibility': {
      const required = input.required as Row, offered = input.offered as Row, need = keyed(required.tools as Row[], 'name'), have = keyed(offered.tools as Row[], 'name')
      const issues: string[] = []
      for (const key of ['protocolVersion', 'transport']) if (required[key] !== offered[key]) issues.push(`${key}-mismatch`)
      for (const name of sorted([...need.keys()])) {
        if (!have.has(name)) { issues.push(`missing-tool:${name}`); continue }
        for (const key of ['inputSchemaDigest', 'outputSchemaDigest']) if (need.get(name)![key] !== have.get(name)![key]) issues.push(`${key}-mismatch:${name}`)
      }
      return { state: issues.length ? 'incompatible' : 'exact-declarations-compatible', issues, comparison: 'exact-schema-digests; no semantic subtyping', serverContacted: false, officialConformanceClaimed: false }
    }
    case 'tool-permission-diff': {
      const before = input.before as Row[], after = input.after as Row[]
      const keys = (rows: Row[]) => rows.map(r => microDigest(r))
      const bk = keys(before), ak = keys(after)
      if (new Set(bk).size !== bk.length || new Set(ak).size !== ak.length || [...before, ...after].some(r => !(r.resource as string).trim())) throw new Error('duplicate-or-empty-permission')
      const order = (rows: Row[]) => rows.sort((a, b) => microDigest(a) < microDigest(b) ? -1 : 1)
      const added = order(after.filter((_, i) => !bk.includes(ak[i]))), removed = order(before.filter((_, i) => !ak.includes(bk[i])))
      return { added, removed, wildcardAdditions: added.filter(r => /[*?]/.test(r.resource as string)), effectiveAuthorizationEvaluated: false }
    }
    case 'publication-bundle-consistency': {
      const url = new URL(input.canonicalUrl as string)
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href !== input.canonicalUrl) throw new Error('noncanonical-url')
      const views = input.views as Row[]; unique(views, 'viewId')
      const results = [...views].sort((a, b) => String(a.viewId) < String(b.viewId) ? -1 : 1).map(v => ({ viewId: v.viewId, mismatches: [...['canonicalUrl', 'contentDigest', 'releaseDigest', 'sourceSetDigest'].filter(k => v[k] !== input[k]), ...(v.status !== 'active' ? ['not-active'] : [])] }))
      const missingKinds = ['article', 'registry', 'api'].filter(k => !views.some(v => v.kind === k))
      return { consistent: !missingKinds.length && results.every(r => !r.mismatches.length), views: results, missingKinds, liveFetchPerformed: false, releaseCreated: false }
    }
  }
}
