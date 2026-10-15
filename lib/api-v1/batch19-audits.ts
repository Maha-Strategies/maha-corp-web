import { id, digest, hash } from './batch5-core.ts'
import { publicRecordSuite, declaredMoneyAudits, declaredWindowAudit, declaredModuleCoverage } from './batch18-core.ts'
import { declaredCountAudits } from './batch17-counts.ts'
import { MARKET_CATALOGUE_AUDITS } from './batch18-market.ts'

const marketBoundary = 'Caller-supplied public or synthetic nonpersonal merchant/SKU declarations only. No inventory lookup, checkout, customer identities, fulfillment, rights clearance or availability guarantee. Amounts and windows are declarations, not independently verified offers.'
const marketFrame = { merchantRef: id, catalogueRef: id, skuRef: id, catalogueRevision: digest, productDigest: digest, scopeRef: id }
const marketSample = { id: 'product1', merchantRef: 'merchant1', catalogueRef: 'catalogue1', skuRef: 'synthetic-sku1', catalogueRevision: hash, productDigest: hash, scopeRef: 'public-metadata' }
const marketPins = { merchantRef: marketSample.merchantRef, catalogueRef: marketSample.catalogueRef, skuRef: marketSample.skuRef, catalogueRevision: hash, productDigest: hash, scopeRef: marketSample.scopeRef }
const marketPolicy = { category: 'market-catalogues', boundary: marketBoundary, frame: marketFrame, sample: marketPins }
const marketOverrides = new Map([...declaredMoneyAudits(marketPolicy), declaredWindowAudit(marketPolicy), declaredModuleCoverage({ ...marketPolicy, modules: ['description', 'format-manifest', 'delivery-policy', 'rights-declaration'] })].map(s => [s.id, s]))
export const BATCH19_MARKET = MARKET_CATALOGUE_AUDITS.slice(2).map(s => marketOverrides.get(s.id) ?? s)

const scienceBoundary = 'Public or synthetic nonpersonal dataset-manifest metadata only: no patient, participant, genomic or raw experimental records. No dataset download, schema resolution, license verification, scientific validity, reproducibility or fitness certification. Counts refer to declared manifest entries, not biological subjects or inferred observations.'
const scienceFrame = { repositoryRef: id, datasetRef: id, schemaRef: id, methodRef: id, datasetRevision: digest, manifestDigest: digest, scopeRef: id }
const scienceSample = { id: 'dataset1', repositoryRef: 'repository1', datasetRef: 'synthetic-dataset1', schemaRef: 'schema1', methodRef: 'declared-method1', datasetRevision: hash, manifestDigest: hash, scopeRef: 'public-metadata' }
const { id: scienceRowId, ...sciencePins } = scienceSample
const sciencePolicy = { category: 'scientific-dataset-records', boundary: scienceBoundary, frame: scienceFrame, sample: sciencePins }
export const BATCH19_SCIENCE = publicRecordSuite({ category: sciencePolicy.category, boundary: scienceBoundary, noun: 'repository/dataset/schema/method/revision-pinned manifest declarations', pins: scienceFrame, sample: scienceSample,
  owner: 'repositoryRef', subject: 'datasetRef', revision: 'datasetRevision', content: 'manifestDigest', units: ['records', 'variables'], unitMeaning: 'declared manifest count kind' },
  [...declaredCountAudits({ ...sciencePolicy, sample: { ...sciencePins, id: scienceRowId }, quantities: ['record-count', 'variable-count'], units: ['records', 'variables'], compatible: { 'record-count': ['records'], 'variable-count': ['variables'] }, sampleQuantity: 'record-count', sampleUnit: 'records' }),
    declaredWindowAudit(sciencePolicy), declaredModuleCoverage({ ...sciencePolicy, modules: ['schema', 'method-declaration', 'variable-manifest', 'license-declaration'] })])
  .filter(s => s.id !== 'scientific-dataset-records-missingness-cooccurrence')

const bibliographyBoundary = 'Public or synthetic nonpersonal bibliographic manifest identifiers only. No author/person profiles, abstracts, full text, DOI lookup, citation database query or source-byte verification. Declared coverage does not establish citation correctness, publication authenticity, scholarly quality or reuse permission.'
const bibliographyFrame = { corpusRef: id, workRef: id, styleRef: id, bibliographyRevision: digest, entryDigest: digest, scopeRef: id }
const bibliographySample = { id: 'entry1', corpusRef: 'corpus1', workRef: 'synthetic-work1', styleRef: 'declared-style1', bibliographyRevision: hash, entryDigest: hash, scopeRef: 'public-metadata' }
const { id: bibliographyRowId, ...bibliographyPins } = bibliographySample
const bibliographyPolicy = { category: 'bibliographies', boundary: bibliographyBoundary, frame: bibliographyFrame, sample: bibliographyPins }
export const BATCH19_BIBLIOGRAPHIES = publicRecordSuite({ category: bibliographyPolicy.category, boundary: bibliographyBoundary, noun: 'corpus/work/style/revision-pinned bibliography declarations', pins: bibliographyFrame, sample: bibliographySample,
  owner: 'corpusRef', subject: 'workRef', revision: 'bibliographyRevision', content: 'entryDigest', units: ['entries', 'citations'], unitMeaning: 'declared bibliographic count kind' },
  [...declaredCountAudits({ ...bibliographyPolicy, sample: { ...bibliographyPins, id: bibliographyRowId }, quantities: ['entry-count', 'citation-count'], units: ['entries', 'citations'], compatible: { 'entry-count': ['entries'], 'citation-count': ['citations'] }, sampleQuantity: 'entry-count', sampleUnit: 'entries' }),
    declaredWindowAudit(bibliographyPolicy), declaredModuleCoverage({ ...bibliographyPolicy, modules: ['work-identifier', 'edition-declaration', 'locator-manifest', 'source-declaration'] })])
  .filter(s => s.id !== 'bibliographies-identifier-crosswalk-audit')

const readingBoundary = 'Public or synthetic nonpersonal reading-plan manifests only. No book text, reader identity, reading telemetry, source lookup or model. Counts and edition/section pins are caller declarations, not verified reading completion, learning outcomes, edition freshness or rights.'
const readingFrame = { libraryRef: id, planRef: id, workRef: id, editionDigest: digest, planRevision: digest, planDigest: digest, scopeRef: id }
const readingSample = { id: 'plan1', libraryRef: 'library1', planRef: 'synthetic-plan1', workRef: 'work1', editionDigest: hash, planRevision: hash, planDigest: hash, scopeRef: 'public-metadata' }
const { id: readingRowId, ...readingPins } = readingSample
const readingPolicy = { category: 'reading-plans', boundary: readingBoundary, frame: readingFrame, sample: readingPins }
export const REVIEWED_READING_PLAN_AUDITS = publicRecordSuite({ category: readingPolicy.category, boundary: readingBoundary, noun: 'library/plan/work/edition/revision-pinned reading manifests', pins: readingFrame, sample: readingSample,
  owner: 'libraryRef', subject: 'planRef', revision: 'planRevision', content: 'planDigest', units: ['sections', 'pages'], unitMeaning: 'declared reading-unit count kind' },
  [...declaredCountAudits({ ...readingPolicy, sample: { ...readingPins, id: readingRowId }, quantities: ['section-count', 'page-count'], units: ['sections', 'pages'], compatible: { 'section-count': ['sections'], 'page-count': ['pages'] }, sampleQuantity: 'section-count', sampleUnit: 'sections' }), declaredWindowAudit(readingPolicy)])
export const BATCH19_READING = REVIEWED_READING_PLAN_AUDITS.slice(0, 6)

export const NINETEENTH_BATCH_AUDITS = [...BATCH19_MARKET, ...BATCH19_SCIENCE, ...BATCH19_BIBLIOGRAPHIES, ...BATCH19_READING]
if (NINETEENTH_BATCH_AUDITS.length !== 50 || new Set(NINETEENTH_BATCH_AUDITS.map(s => s.id)).size !== 50) throw Error('invalid_batch19_scope')
const byId = new Map(NINETEENTH_BATCH_AUDITS.map(s => [s.id, s]))
export const batch19Audit = (id: string) => byId.get(id)
export const NINETEENTH_BATCH_SAMPLES = Object.fromEntries(NINETEENTH_BATCH_AUDITS.map(s => [s.id, s.sample]))
