import { z } from 'zod'
import { briefSchema, compileRelease, validateRelease, retrievalSchema, retrievalInput, LICENSE, LOCAL_BOUNDARY, type Release } from '../../agent-publishing/contracts.ts'
import { demandDigest } from '../../x402/demand6/digest.ts'
import type { HandlerContract, Domain } from '../types.ts'
import { LocalReleaseJournal, withLocalReleases } from './releases.ts'

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100)
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/)
const source = z.object({ id, url: z.url().max(2000).refine(s => s.startsWith('https://')), locator: z.string().min(1).max(400) }).strict()
const artifactSchema = z.object({ ...briefSchema.shape, schemaVersion: z.literal('maha-agent-publication/1'), contentSha256: hash,
  license: z.object({ id: z.literal(LICENSE.id), grant: z.literal(LICENSE.grant), redistributionAllowed: z.literal(false), resaleAllowed: z.literal(false),
    modelTrainingRightsGranted: z.literal(false), copyrightTransferred: z.literal(false), publicPublicationAuthorized: z.literal(false) }).strict(),
  licenseSha256: hash, boundary: z.literal(LOCAL_BOUNDARY), artifactSha256: hash }).strict()
const claims = z.object({ dataClass: z.enum(['public', 'synthetic']), claims: z.array(z.object({ id, text: z.string().min(1).max(1000), sourceIds: z.array(id).max(10) }).strict()).min(1).max(40), sources: z.array(source).max(40) }).strict().superRefine((v, ctx) => {
  if (new Set(v.claims.map(c => c.id)).size !== v.claims.length || new Set(v.sources.map(s => s.id)).size !== v.sources.length
    || v.claims.some(c => new Set(c.sourceIds).size !== c.sourceIds.length)) ctx.addIssue({ code: 'custom', message: 'Identifiers must be unique.' })
})
const retrieved = z.object({ purchasedRelease: retrievalSchema, deliveredRelease: retrievalSchema, complimentaryCorrection: z.boolean(), artifact: artifactSchema, inputHash: hash,
  editorialApproval: z.literal('pending'), publicPublicationAuthorized: z.literal(false), localPreview: z.literal(true) }).strict().superRefine((v, ctx) => {
  try { const expected = validateRelease(v.artifact as Release); if (demandDigest(retrievalInput(expected)) !== demandDigest(v.deliveredRelease)) throw Error() }
  catch { ctx.addIssue({ code: 'custom', message: 'Artifact commitment invalid.' }) }
  if (v.purchasedRelease.publicationId !== v.deliveredRelease.publicationId || v.purchasedRelease.licenseSha256 !== v.deliveredRelease.licenseSha256
    || v.inputHash !== demandDigest(v.purchasedRelease) || v.complimentaryCorrection !== (v.purchasedRelease.artifactSha256 !== v.deliveredRelease.artifactSha256)) {
    ctx.addIssue({ code: 'custom', message: 'Purchased identity or correction binding invalid.' })
  }
})
const outputs = {
  'publication-pinned-brief': retrieved,
  'publication-release-comparison': z.object({ before: retrievalSchema, after: retrievalSchema, changedFields: z.array(z.enum(['title', 'summary', 'markdown', 'sources', 'findings', 'limitations', 'license'])).max(7), addedFindingIds: z.array(id).max(10), removedFindingIds: z.array(id).max(10), changedFindingIds: z.array(id).max(10), addedSourceIds: z.array(id).max(10), removedSourceIds: z.array(id).max(10), causalExplanationProvided: z.literal(false) }).strict(),
  'publication-citation-coverage': z.object({ claimCount: z.number().int().min(1).max(40), boundClaimCount: z.number().int().min(0).max(40), unboundClaimIds: z.array(id).max(40), unknownReferences: z.array(z.object({ claimId: id, sourceId: id }).strict()).max(400), unusedSourceIds: z.array(id).max(40), sourcesFetched: z.literal(false), entailmentVerified: z.literal(false) }).strict(),
  'publication-correction-impact': z.object({ references: z.array(z.object({ referenceId: id, publicationId: id, state: z.enum(['current', 'changed', 'withdrawn', 'unknown']), eventSequences: z.array(z.number().int().positive()).max(100) }).strict()).max(40), completenessEstablished: z.literal(false), conclusionsInvalidated: z.literal(false) }).strict(),
  'publication-package-preflight': z.object({ artifactSha256: hash, licenseSha256: hash, sourceCount: z.number().int().min(1).max(10), findingCount: z.number().int().min(1).max(10), wordCount: z.number().int().min(1).max(2500), bindingValid: z.literal(true), editorialApproval: z.literal('pending'), releaseCreated: z.literal(false), sourceTruthVerified: z.literal(false) }).strict(),
}
export const PUBLICATION_PRODUCTS = [
  { id: 'publication-pinned-brief', name: 'Pinned Evidence Brief', domain: 'library' as Domain, category: 'publications', action: 'retrieve', price: 50000, description: 'Retrieve one exact local evidence brief with source bindings, edition and license hashes. AI-written preview; human approval pending. No factual certification, redistribution or training rights.' },
  { id: 'publication-release-comparison', name: 'Publication Release Comparison', domain: 'library' as Domain, category: 'publications', action: 'compare', price: 17000, description: 'Compare two exact local releases of the same publication; enumerate changed text, findings and source IDs. No source fetching, causal explanation or editorial approval.' },
  { id: 'publication-citation-coverage', name: 'Citation Coverage Audit', domain: 'verify' as Domain, category: 'publications', action: 'citation-coverage', price: 11000, description: 'Check up to 40 caller-declared claims and sources for unbound or unresolved citation IDs. Public/synthetic only. No passage inspection, entailment or truth verification.' },
  { id: 'publication-correction-impact', name: 'Correction Reference Impact', domain: 'intel' as Domain, category: 'publications', action: 'correction-impact', price: 29000, description: 'Map up to 40 declared references against supplied bounded publication events; report changed, withdrawn or unknown identities. No automatic invalidation of conclusions or completeness claim.' },
  { id: 'publication-package-preflight', name: 'Agent Publication Package Preflight', domain: 'verify' as Domain, category: 'publications', action: 'preflight', price: 37000, description: 'Validate a bounded AI-preview brief contract, finding/source bindings and compiled content/license commitments. Does not create a release, approve publication, grant rights or verify sources.' },
] as const
export type PublicationProductId = typeof PUBLICATION_PRODUCTS[number]['id']
const impact = z.object({ dataClass: z.enum(['public', 'synthetic']), references: z.array(z.object({ referenceId: id, ...retrievalSchema.shape }).strict()).min(1).max(40), events: z.array(z.object({ sequence: z.number().int().positive(), ...retrievalSchema.shape, kind: z.enum(['released', 'updated', 'corrected', 'withdrawn']) }).strict()).max(100) }).strict().superRefine((v, ctx) => {
  if (new Set(v.references.map(r => r.referenceId)).size !== v.references.length || new Set(v.events.map(e => e.sequence)).size !== v.events.length) ctx.addIssue({ code: 'custom', message: 'Duplicate identities.' })
})
export const PUBLICATION_INPUTS = { 'publication-pinned-brief': retrievalSchema,
  'publication-release-comparison': z.object({ before: retrievalSchema, after: retrievalSchema }).strict().refine(v => v.before.publicationId === v.after.publicationId, 'Compare one publication.'),
  'publication-citation-coverage': claims, 'publication-correction-impact': impact, 'publication-package-preflight': briefSchema }
export const PUBLICATION_OUTPUTS = outputs
type Open = <T>(effect: (journal: LocalReleaseJournal) => T) => T
function delivery(input: z.infer<typeof retrievalSchema>, release: Release) { return { purchasedRelease: input, deliveredRelease: retrievalInput(release), complimentaryCorrection: release.artifactSha256 !== input.artifactSha256,
  artifact: release, inputHash: demandDigest(input), editorialApproval: 'pending', publicPublicationAuthorized: false, localPreview: true } }
export function publicationHandler(id: PublicationProductId, open: Open = withLocalReleases): HandlerContract {
  return { input: PUBLICATION_INPUTS[id], output: outputs[id],
    execute: async supplied => {
      if (id === 'publication-pinned-brief') { const input = retrievalSchema.parse(supplied); return open(j => delivery(input, j.read(input))) }
      if (id === 'publication-release-comparison') { const input = PUBLICATION_INPUTS[id].parse(supplied); return open(j => {
        const before = j.read(input.before), after = j.read(input.after)
        const changedFields = (['title', 'summary', 'markdown', 'sources', 'findings', 'limitations', 'license'] as const).filter(k => demandDigest(before[k]) !== demandDigest(after[k]))
        const a = new Map(before.findings.map(f => [f.id, f])), b = new Map(after.findings.map(f => [f.id, f]))
        return { ...input, changedFields, addedFindingIds: [...b.keys()].filter(k => !a.has(k)), removedFindingIds: [...a.keys()].filter(k => !b.has(k)), changedFindingIds: [...a.keys()].filter(k => b.has(k) && demandDigest(a.get(k)) !== demandDigest(b.get(k))), addedSourceIds: after.sources.filter(s => !before.sources.some(x => x.id === s.id)).map(s => s.id), removedSourceIds: before.sources.filter(s => !after.sources.some(x => x.id === s.id)).map(s => s.id), causalExplanationProvided: false }
      }) }
      if (id === 'publication-citation-coverage') { const input = claims.parse(supplied), known = new Set(input.sources.map(s => s.id)), used = new Set(input.claims.flatMap(c => c.sourceIds))
        return { claimCount: input.claims.length, boundClaimCount: input.claims.filter(c => c.sourceIds.length > 0 && c.sourceIds.every(s => known.has(s))).length,
          unboundClaimIds: input.claims.filter(c => !c.sourceIds.length).map(c => c.id), unknownReferences: input.claims.flatMap(c => c.sourceIds.filter(s => !known.has(s)).map(s => ({ claimId: c.id, sourceId: s }))), unusedSourceIds: input.sources.filter(s => !used.has(s.id)).map(s => s.id), sourcesFetched: false, entailmentVerified: false } }
      if (id === 'publication-correction-impact') { const input = impact.parse(supplied); return { references: input.references.map(r => {
        const events = input.events.filter(e => e.publicationId === r.publicationId).sort((a, b) => a.sequence - b.sequence), latest = events.at(-1)
        const pinned = events.some(e => e.releaseId === r.releaseId && e.artifactSha256 === r.artifactSha256 && e.licenseSha256 === r.licenseSha256)
        return { referenceId: r.referenceId, publicationId: r.publicationId, state: !pinned ? 'unknown' : latest?.kind === 'withdrawn' ? 'withdrawn' : latest?.artifactSha256 === r.artifactSha256 ? 'current' : 'changed', eventSequences: events.map(e => e.sequence) }
      }), completenessEstablished: false, conclusionsInvalidated: false } }
      const input = briefSchema.parse(supplied), compiled = compileRelease(input)
      return { artifactSha256: compiled.artifactSha256, licenseSha256: compiled.licenseSha256, sourceCount: input.sources.length, findingCount: input.findings.length, wordCount: input.markdown.split(/\s+/).length, bindingValid: true, editorialApproval: 'pending', releaseCreated: false, sourceTruthVerified: false }
    },
    ...(id === 'publication-pinned-brief' ? { beforeSettlement: async input => { open(j => j.read(retrievalSchema.parse(input))) },
      recoverCorrection: async (input, purchased) => { const original = retrievalSchema.parse(input); retrieved.parse(purchased); return open(j => delivery(original, j.correction(original))) } } : {}),
  }
}
