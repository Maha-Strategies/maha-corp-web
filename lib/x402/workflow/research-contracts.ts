import { z } from 'zod'
const doi = z.string().min(6).max(240).regex(/^(?:https:\/\/doi\.org\/)?10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/)
const base = { dataClass: z.enum(['public', 'synthetic']) }
export const RESEARCH_INPUTS = {
  'research-publication-update-snapshot': z.object({ ...base, doi }).strict(),
  'research-data-software-links': z.object({ ...base, doi }).strict(),
  'research-funding-lineage': z.object({ ...base, doi }).strict(),
  'research-bibliography-resolution': z.object({ ...base, dois: z.array(doi).min(1).max(5) }).strict(),
  'research-trial-status-snapshot': z.object({ ...base, nctId: z.string().regex(/^NCT\d{8}$/) }).strict(),
} as const
export type ResearchId = keyof typeof RESEARCH_INPUTS
const text = z.string().min(1).max(500)
const no = z.literal(false)
export const SOURCE_OBSERVATION = z.object({ url: z.url().max(2048), retrievedAt: z.iso.datetime(),
  rawBytesSha256: z.string().regex(/^sha256:[a-f0-9]{64}$/), providerUpdatedAt: z.string().max(80).nullable(),
  provider: z.enum(['Crossref', 'ClinicalTrials.gov']), rightsBasis: text, sourceCompletenessEstablished: no }).strict()
const update = z.object({ doi: text, type: text, date: z.string().max(80).nullable() }).strict()
const summary = z.object({ doi: text, title: text.nullable(), publisher: text.nullable(), type: text.nullable(),
  publicationDate: z.string().max(80).nullable() }).strict()
export const RESEARCH_RESULTS = {
  'research-publication-update-snapshot': z.object({ queriedDoi: text, sources: z.array(SOURCE_OBSERVATION).min(1).max(2),
    thisRecordUpdates: z.array(update).max(20), recordsUpdatingThisDoi: z.array(update).max(10), updatingRecordCount: z.number().int().min(0),
    truncated: z.boolean(), absenceProvesUnretracted: no }).strict(),
  'research-data-software-links': z.object({ work: summary, source: SOURCE_OBSERVATION,
    declaredRelations: z.array(z.object({ relation: text, identifier: text, identifierType: text }).strict()).max(40),
    missingRelationMetadata: z.boolean(), relationsTruncated: z.boolean(), linkedDataFetched: no, reproducibilityEstablished: no }).strict(),
  'research-funding-lineage': z.object({ work: summary, source: SOURCE_OBSERVATION,
    funders: z.array(z.object({ name: text.nullable(), doi: text.nullable(), doiAssertedBy: text.nullable(), awards: z.array(text).max(10) }).strict()).max(10),
    truncated: z.boolean(), grantAwardVerified: no, completenessEstablished: no }).strict(),
  'research-bibliography-resolution': z.object({ records: z.array(z.object({ requestedDoi: text,
    state: z.enum(['exact_metadata_match', 'not_found']), work: summary.nullable(), source: SOURCE_OBSERVATION }).strict()).min(1).max(5),
    normalization: z.literal('exact-doi-case-fold-and-doi-org-prefix'), fuzzyMatchingPerformed: no, fullTextReturned: no }).strict(),
  'research-trial-status-snapshot': z.object({ nctId: z.string().regex(/^NCT\d{8}$/), overallStatus: text.nullable(),
    lastUpdatePostDate: z.string().max(80).nullable(), source: SOURCE_OBSERVATION,
    contactOrParticipantDataReturned: no, clinicalRecommendationProvided: no, registryStatusIndependentlyVerified: no }).strict(),
} as const
export const normalizeDoi = (value: string) => doi.parse(value).replace(/^https:\/\/doi\.org\//, '').toLowerCase()
