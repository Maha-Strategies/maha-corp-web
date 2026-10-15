import { id, digest, hash } from './batch5-core.ts'
import { publicRecordSuite, declaredWindowAudit, declaredModuleCoverage } from './batch18-core.ts'
import { declaredCountAudits } from './batch17-counts.ts'
import { REVIEWED_READING_PLAN_AUDITS } from './batch19-audits.ts'

const readingBoundary = 'Caller-supplied public or synthetic nonpersonal reading-plan manifests only; no reader telemetry, book text, source lookup, model, rights clearance or learning-outcome claim.'
const readingFrame = { libraryRef: id, planRef: id, workRef: id, editionDigest: digest, planRevision: digest, planDigest: digest, scopeRef: id }
const readingSample = { libraryRef: 'library1', planRef: 'synthetic-plan1', workRef: 'work1', editionDigest: hash, planRevision: hash, planDigest: hash, scopeRef: 'public-metadata' }
const readingCoverage = declaredModuleCoverage({ category: 'reading-plans', boundary: readingBoundary, frame: readingFrame, sample: readingSample, modules: ['edition-pin', 'section-order', 'source-manifest', 'scope-declaration'] })
export const BATCH20_READING = REVIEWED_READING_PLAN_AUDITS.slice(6).filter(s => s.id !== 'reading-plans-reference-integrity-map').map(s => s.id === readingCoverage.id ? readingCoverage : s)

const editionBoundary = 'Public or synthetic nonpersonal edition-manifest declarations only. No manuscript text, book download, ISBN lookup, identity, rights/license verification or freshness guarantee. An edition digest is a supplied pin, not proof of publisher authority.'
const editionFrame = { publisherRef: id, workRef: id, editionRef: id, formatRef: id, editionRevision: digest, manifestDigest: digest, scopeRef: id }
const editionPins = { publisherRef: 'publisher1', workRef: 'synthetic-work1', editionRef: 'edition1', formatRef: 'epub', editionRevision: hash, manifestDigest: hash, scopeRef: 'public-metadata' }
const editionSample = { ...editionPins, id: 'edition-row1' }
const editionPolicy = { category: 'edition-records', boundary: editionBoundary, frame: editionFrame, sample: editionPins }
export const BATCH20_EDITIONS = publicRecordSuite({ category: editionPolicy.category, boundary: editionBoundary, noun: 'publisher/work/edition/format/revision-pinned edition declarations', pins: editionFrame, sample: editionSample,
  owner: 'publisherRef', subject: 'workRef', revision: 'editionRevision', content: 'manifestDigest', units: ['sections', 'pages'], unitMeaning: 'declared edition count kind' },
  [...declaredCountAudits({ ...editionPolicy, sample: editionSample, quantities: ['section-count', 'page-count'], units: ['sections', 'pages'], compatible: { 'section-count': ['sections'], 'page-count': ['pages'] }, sampleQuantity: 'section-count', sampleUnit: 'sections' }),
    declaredWindowAudit(editionPolicy), declaredModuleCoverage({ ...editionPolicy, modules: ['front-matter', 'body-manifest', 'back-matter', 'rights-declaration'] })])

const glossaryBoundary = 'Public or synthetic nonpersonal glossary-manifest identifiers only; no full definitions, personal data, terminology-service lookup or model inference. Coverage and crosswalks do not establish semantic equivalence, translation accuracy, scientific validity or ownership.'
const glossaryFrame = { vocabularyRef: id, termRef: id, languageRef: id, namespaceRef: id, glossaryRevision: digest, definitionDigest: digest, scopeRef: id }
const glossaryPins = { vocabularyRef: 'vocabulary1', termRef: 'synthetic-term1', languageRef: 'en', namespaceRef: 'declared-namespace1', glossaryRevision: hash, definitionDigest: hash, scopeRef: 'public-metadata' }
const glossarySample = { ...glossaryPins, id: 'term-row1' }
const glossaryPolicy = { category: 'glossary-records', boundary: glossaryBoundary, frame: glossaryFrame, sample: glossaryPins }
export const BATCH20_GLOSSARY = publicRecordSuite({ category: glossaryPolicy.category, boundary: glossaryBoundary, noun: 'vocabulary/term/language/namespace/revision-pinned glossary declarations', pins: glossaryFrame, sample: glossarySample,
  owner: 'vocabularyRef', subject: 'termRef', revision: 'glossaryRevision', content: 'definitionDigest', units: ['terms', 'definitions'], unitMeaning: 'declared glossary count kind' },
  [...declaredCountAudits({ ...glossaryPolicy, sample: glossarySample, quantities: ['term-count', 'definition-count'], units: ['terms', 'definitions'], compatible: { 'term-count': ['terms'], 'definition-count': ['definitions'] }, sampleQuantity: 'term-count', sampleUnit: 'terms' }),
    declaredWindowAudit(glossaryPolicy), declaredModuleCoverage({ ...glossaryPolicy, modules: ['term-identifier', 'definition-pin', 'language-declaration', 'source-declaration'] })]).slice(0, 11)

export const TWENTIETH_BATCH_AUDITS = [...BATCH20_READING, ...BATCH20_EDITIONS, ...BATCH20_GLOSSARY]
if (TWENTIETH_BATCH_AUDITS.length !== 36 || new Set(TWENTIETH_BATCH_AUDITS.map(s => s.id)).size !== 36) throw Error('invalid_batch20_metadata_scope')
const byId = new Map(TWENTIETH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch20Audit = (id: string) => byId.get(id)
