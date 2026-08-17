import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { ASTROLOGY_VERSION } from '../lib/astrology-traditions.ts'
import { digestOf } from '../lib/celestial-hypotheses/canonical.ts'
import { buildStructuredVerdict } from '../lib/celestial-hypotheses/verdict.ts'
import { COMPILER_VERSION } from '../lib/interpretation-compiler.ts'
import { buildLocalFactBundle } from '../lib/local-fact-bundle.ts'

const EVIDENCE_VERSION = 'production-celestial-study-evidence/0.1' as const
const DEFAULT_BASE_URL = 'https://www.mahastrategies.com'
const FORBIDDEN_EVIDENCE_KEYS = /participant|pseudonym|natal|birth|observer|latitude|longitude|coordinates?/i

type Json = Record<string, unknown>

function iso(milliseconds: number): string {
  return new Date(milliseconds).toISOString()
}

function stableSuffix(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20)
}

function object(value: unknown, label: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} was not a JSON object.`)
  return value as Json
}

async function requestJson(baseUrl: string, token: string, path: string, init: RequestInit, expected: number): Promise<Json> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
  })
  const body = object(await response.json().catch(() => ({})), path)
  if (response.status !== expected) {
    const error = object(body.error ?? {}, 'error')
    throw new Error(`${init.method ?? 'GET'} ${path} returned ${response.status}: ${String(error.code ?? 'unknown')} ${String(error.message ?? '')}`)
  }
  return body
}

function scrubbedExposureSummary(value: unknown): Json {
  const summary = object(value, 'exposureSummary')
  return {
    observations: summary.observations,
    milestones: summary.milestones,
    nonEvents: summary.nonEvents,
    corpusBaselineMilestoneRate: summary.corpusBaselineMilestoneRate,
    boundary: summary.boundary,
  }
}

export function assertSanitizedCelestialStudyEvidence(value: unknown): void {
  const visit = (item: unknown, path: string): void => {
    if (Array.isArray(item)) {
      item.forEach((entry, index) => visit(entry, `${path}[${index}]`))
      return
    }
    if (!item || typeof item !== 'object') return
    for (const [key, nested] of Object.entries(item as Json)) {
      if (FORBIDDEN_EVIDENCE_KEYS.test(key)) throw new Error(`Sanitized evidence contains prohibited key ${path}.${key}.`)
      visit(nested, `${path}.${key}`)
    }
  }
  visit(value, '$')
  const serialized = JSON.stringify(value)
  if (/pseudo_[a-z0-9]+/i.test(serialized)) throw new Error('Sanitized evidence contains a participant pseudonym.')
  if (/1999-12-31|2000-01-01|profileSha256/i.test(serialized)) throw new Error('Sanitized evidence contains synthetic profile material.')
}

export async function runProductionCelestialStudy(environment: NodeJS.ProcessEnv = process.env): Promise<Json> {
  const baseUrl = (environment.PRODUCTION_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const token = environment.CELESTIAL_REGISTRY_TOKEN?.trim()
  const outputPath = environment.PRODUCTION_CELESTIAL_STUDY_OUTPUT_PATH?.trim()
  if (!token || Buffer.byteLength(token, 'utf8') < 32) throw new Error('CELESTIAL_REGISTRY_TOKEN must contain at least 32 bytes.')
  if (!/(^|\.)mahastrategies\.com$/.test(new URL(baseUrl).host)) throw new Error(`Refusing non-Production host ${baseUrl}.`)

  const startedAt = new Date()
  const runReference = `${environment.GITHUB_RUN_ID ?? 'manual'}-${startedAt.toISOString()}`
  const suffix = stableSuffix(runReference)
  const corpusId = `corp_${suffix}`
  const experimentId = `exp_${suffix}`
  const participantPseudonym = `pseudo_${stableSuffix(`participant-${runReference}`).slice(0, 16)}`
  const syntheticProfile = { date: '2000-01-01', time: '12:00', timeZone: 'UTC', latitudeDegrees: 0, longitudeDegrees: 0 }

  console.log(`Production celestial operational study ${environment.GITHUB_RUN_ID ?? 'manual'}`)
  console.log(`Host: ${baseUrl}`)

  // Corpus: draft -> schedule -> lock -> milestone -> non-event -> analysis.
  const minute = Math.floor(startedAt.getTime() / 60_000) * 60_000
  const anchor = minute - 60 * 60_000
  const windowStart = anchor - 60 * 60_000
  const windowEnd = minute + 60 * 60_000
  const definition = {
    corpusId,
    participantPseudonym,
    studyRole: 'exploratory',
    corpusVersion: 'celestial-event-corpus/0.1',
    samplingPlan: {
      planVersion: 'systematic-clock/1',
      windowStartUtc: iso(windowStart),
      windowEndUtc: iso(windowEnd),
      anchorUtc: iso(anchor),
      cadenceMinutes: 60,
      intervalMinutes: 5,
      activityType: 'synthetic-operations-check',
      qualifyingEventDefinition: 'A synthetic lifecycle milestone emitted by this approved Production verification workflow.',
      negativeEvidenceProcedure: 'Query the bounded synthetic runner ledger for the complete scheduled interval and record a zero-count evidence envelope.',
    },
  }
  const corpusDraft = await requestJson(baseUrl, token, '/api/v1/celestial-corpus/corpora', {
    method: 'POST', body: JSON.stringify({ definition, natalProfile: syntheticProfile }),
  }, 201)
  const storedDraft = object(corpusDraft.corpus, 'corpus draft')
  console.log('PASS corpus draft')

  const schedule = await requestJson(baseUrl, token, `/api/v1/celestial-corpus/corpora/${corpusId}/schedule`, { method: 'GET' }, 200)
  const candidates = Array.isArray(schedule.candidates) ? schedule.candidates : []
  if (candidates.length < 1) throw new Error('The corpus schedule returned no denominator candidates.')
  console.log(`PASS corpus schedule (${candidates.length} candidates)`)

  const locked = await requestJson(baseUrl, token, `/api/v1/celestial-corpus/corpora/${corpusId}/lock`, { method: 'POST' }, 200)
  const storedLocked = object(locked.corpus, 'locked corpus')
  if (storedLocked.status !== 'locked') throw new Error('The corpus did not enter locked state.')
  console.log('PASS corpus lock')

  const milestoneStart = anchor + 15 * 60_000
  const milestone = await requestJson(baseUrl, token, `/api/v1/celestial-corpus/corpora/${corpusId}/observations`, {
    method: 'POST',
    body: JSON.stringify({ natalProfile: syntheticProfile, observations: [{
      observationId: `obs_${suffix}m`, kind: 'milestone', selectionMethod: 'observed-event',
      intervalStartUtc: iso(milestoneStart), intervalEndUtc: iso(milestoneStart + 60_000),
      sourceKind: 'synthetic-runner-event', dataSourceId: 'github-actions-production-study',
      evidencePayload: { runReference, event: 'synthetic-milestone', emittedAtUtc: iso(milestoneStart) },
    }] }),
  }, 201)
  console.log('PASS corpus milestone')

  const nonEventEnd = anchor + 5 * 60_000
  const nonEvent = await requestJson(baseUrl, token, `/api/v1/celestial-corpus/corpora/${corpusId}/observations`, {
    method: 'POST',
    body: JSON.stringify({ natalProfile: syntheticProfile, observations: [{
      observationId: `obs_${suffix}n`, kind: 'non-event', selectionMethod: 'systematic-clock',
      intervalStartUtc: iso(anchor), intervalEndUtc: iso(nonEventEnd),
      sourceKind: 'synthetic-runner-query', dataSourceId: 'github-actions-production-study',
      evidencePayload: {
        queryWindowStartUtc: iso(anchor), queryWindowEndUtc: iso(nonEventEnd), qualifyingEventCount: 0,
        retrievedAtUtc: startedAt.toISOString(), sourceQueryId: `synthetic-zero-${suffix}`,
        rawResult: { runReference, rows: [] },
      },
    }] }),
  }, 201)
  console.log('PASS evidence-backed non-event')

  const corpusAnalysis = await requestJson(baseUrl, token, `/api/v1/celestial-corpus/corpora/${corpusId}/observations`, { method: 'GET' }, 200)
  const corpusSummary = scrubbedExposureSummary(corpusAnalysis.exposureSummary)
  if (corpusSummary.milestones !== 1 || corpusSummary.nonEvents !== 1) throw new Error('Corpus analysis did not retain both observation classes.')
  console.log('PASS corpus descriptive analysis')

  // Hypothesis registry: draft -> register -> action window -> outcome -> analysis -> provenance.
  const plannedAt = Date.now()
  const actionStart = plannedAt + 30_000
  const actionEnd = actionStart + 5_000
  const factInstant = actionStart + 2_000
  const factBundle = buildLocalFactBundle({ instant: new Date(factInstant), latitudeDegrees: 0, longitudeDegrees: 0, observerId: 'obs-synthetic-study' })
  const factBundleSha256 = digestOf(factBundle)
  const metric = {
    metricId: 'schema_http_200', name: 'Celestial schema endpoint HTTP 200 marker', kind: 'binary', unit: 'requests',
    direction: 'higher-is-better' as const, horizonHours: 0.001,
    measurementProcedure: 'Issue one GET request to the public celestial schema endpoint after the action window and record 1 exactly when HTTP status is 200.',
    source: 'instrumented', dataSourceId: 'maha-public-celestial-schema',
  }
  const analysisPlan = {
    planVersion: 'binary-outcome/1', metricId: metric.metricId, targetRate: 0.5, minimumObservations: 1,
    stoppingRule: 'Analyse once at exactly one synthetic observation and never inspect an interim result.',
    multiplicityPolicy: 'One pre-declared operational metric and no subgroup or secondary comparisons.',
  }
  const draft = {
    experimentId, participantPseudonym, studyRole: 'confirmatory',
    hypothesis: {
      statement: 'Synthetic batch jobs begun under the selected rule yield an HTTP 200 celestial-schema response at or above the registered rate.',
      traditionId: 'vedic-jyotisha', ruleIds: ['bs-muhurta-bava-favourable'],
      ruleProvenance: 'restates-source', ruleEmpiricalStatus: 'unvalidated-tradition',
    },
    activityType: 'batch-job-scheduling', actionWindowStartUtc: iso(actionStart), actionWindowEndUtc: iso(actionEnd),
    factBundle, factBundleId: factBundle.bundleId, factBundleSha256,
    compilerVersion: COMPILER_VERSION, ruleRegistryVersion: ASTROLOGY_VERSION,
    metric,
    comparator: {
      policyVersion: 'comparator/1', feasibleWindowStartUtc: iso(plannedAt - 7 * 86_400_000), feasibleWindowEndUtc: iso(plannedAt + 7 * 86_400_000),
      draws: 1, matching: { sameWeekday: true, localHourBand: [0, 23], timeZone: 'UTC', geographyId: 'synthetic-global', sameActivityType: true },
      exclusions: [], seed: `synthetic-seed-${suffix}`,
    },
    analysisPlan, inclusionCriteria: ['The approved Production operational-verification workflow reaches its declared action window.'],
    exclusionCriteria: [], sampleSizeTarget: 1, prohibitedUseAttestation: true,
  } as const
  const verdict = buildStructuredVerdict({
    activityType: draft.activityType, traditionId: draft.hypothesis.traditionId,
    applicableRuleIds: [...draft.hypothesis.ruleIds], factBundleId: draft.factBundleId,
    factBundleSha256: draft.factBundleSha256, ruleRegistryVersion: draft.ruleRegistryVersion,
    metricId: draft.metric.metricId, metricDirection: draft.metric.direction, targetRate: draft.analysisPlan.targetRate,
  })
  const registryDraft = await requestJson(baseUrl, token, '/api/v1/celestial-hypotheses/drafts', {
    method: 'POST', body: JSON.stringify({ draft: { ...draft, verdict }, notes: 'Synthetic Production operational verification; no participant activity.' }),
  }, 201)
  if (registryDraft.registrable !== true) throw new Error(`Synthetic registry draft was blocked: ${JSON.stringify(registryDraft.registrationBlockers)}`)
  console.log('PASS hypothesis draft')

  const registration = await requestJson(baseUrl, token, `/api/v1/celestial-hypotheses/${experimentId}/register`, { method: 'POST' }, 200)
  console.log('PASS hypothesis registration lock')

  const waitMs = Math.max(0, actionEnd + metric.horizonHours * 3_600_000 - Date.now() + 1_000)
  if (waitMs > 60_000) throw new Error(`Refusing an unexpectedly long ${waitMs}ms synthetic horizon.`)
  await new Promise((resolve) => setTimeout(resolve, waitMs))
  const checkedAt = new Date()
  const measured = await fetch(`${baseUrl}/knowledge/celestial/schema`, { headers: { accept: 'application/json' } })
  const value = measured.status === 200 ? 1 : 0
  const outcome = await requestJson(baseUrl, token, `/api/v1/celestial-hypotheses/${experimentId}/outcomes`, {
    method: 'POST', body: JSON.stringify({
      idempotencyKey: `synthetic-outcome-${suffix}`, value,
      observedAtUtc: checkedAt.toISOString(), retrievedAtUtc: checkedAt.toISOString(), dataSourceId: metric.dataSourceId,
      rawPayload: { endpoint: '/knowledge/celestial/schema', status: measured.status, checkedAtUtc: checkedAt.toISOString() },
    }),
  }, 201)
  const outcomeAnalysis = object(outcome.analysis, 'hypothesis analysis')
  if (outcomeAnalysis.status !== 'complete') throw new Error(`Hypothesis analysis remained ${String(outcomeAnalysis.status)}.`)
  console.log(`PASS hypothesis outcome and analysis (${String(outcomeAnalysis.classification)})`)

  const provenanceResponse = await requestJson(baseUrl, token, `/api/v1/celestial-hypotheses/${experimentId}/provenance`, { method: 'GET' }, 200)
  const provenance = object(provenanceResponse.provenance, 'hypothesis provenance')
  console.log('PASS hypothesis provenance')

  const evidence = {
    schemaVersion: EVIDENCE_VERSION,
    studyKind: 'synthetic-production-operational-verification',
    baseUrl,
    sourceCommit: environment.GITHUB_SHA ?? null,
    workflowRunId: environment.GITHUB_RUN_ID ?? null,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    corpus: {
      corpusId, lifecycle: ['draft', 'scheduled', 'locked', 'milestone-recorded', 'non-event-recorded', 'analyzed'],
      definitionSha256: storedLocked.definitionSha256 ?? storedDraft.definitionSha256,
      scheduleCandidateCount: candidates.length,
      milestoneObservationSha256: Array.isArray(milestone.observationSha256) ? milestone.observationSha256[0] : null,
      nonEventObservationSha256: Array.isArray(nonEvent.observationSha256) ? nonEvent.observationSha256[0] : null,
      analysis: corpusSummary,
      epistemicBoundary: corpusAnalysis.epistemicBoundary,
    },
    hypothesis: {
      experimentId, lifecycle: ['draft', 'registered', 'outcome-recorded', 'analyzed'],
      registrationSha256: registration.registrationSha256,
      registeredAtUtc: registration.registeredAtUtc,
      outcomeSha256: outcome.outcomeSha256,
      analysis: outcomeAnalysis,
      provenance,
      epistemicBoundary: provenanceResponse.epistemicBoundary,
    },
    privacy: {
      syntheticInputsOnly: true,
      identifyingDataIncluded: false,
      personalChartDataIncluded: false,
      rawEvidenceIncluded: false,
      publicationCheck: 'recursive-key-and-value-denylist/1',
    },
    conclusion: 'The Production research lifecycle operated end to end. This synthetic run is not evidence that celestial timing predicts outcomes.',
  }
  assertSanitizedCelestialStudyEvidence(evidence)

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  }
  console.log('PASS sanitized provenance publication check')
  return evidence
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionCelestialStudy().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
