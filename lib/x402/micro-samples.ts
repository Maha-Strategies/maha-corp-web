import type { MicroProductId } from './micro-contracts.ts'
const hash = (c: string) => `sha256:${c.repeat(64)}`
const locator = { sourceId: 'synthetic-source', sourceRevision: hash('1'), kind: 'section', value: '3.2' }
export const MICRO_SAMPLE_INPUTS: Record<MicroProductId, Record<string, unknown>> = {
  'citation-binding-check': { dataClass: 'synthetic', bindings: [{ expected: locator, observed: { ...locator } }] },
  'revision-lineage-check': { dataClass: 'synthetic', previous: { objectId: 'synthetic-record', revisionDigest: hash('1'), predecessorDigest: null, relation: 'initial' }, next: { objectId: 'synthetic-record', revisionDigest: hash('2'), predecessorDigest: hash('1'), relation: 'supersedes' } },
  'audit-export-normalizer': { dataClass: 'synthetic', events: [{ eventId: 'event-2', eventType: 'checked', subjectDigest: hash('2'), occurredAt: '2026-09-09T10:00:01.000Z' }, { eventId: 'event-1', eventType: 'received', subjectDigest: hash('1'), occurredAt: '2026-09-09T10:00:00.000Z' }] },
  'dimensional-consistency-check': { dataClass: 'synthetic', left: [1, 0, 0, 0, 0, 0, 0], right: [0, 0, 1, 0, 0, 0, 0], operation: 'divide', expected: [1, 0, -1, 0, 0, 0, 0] },
  'exact-interpolation-receipt': { dataClass: 'synthetic', x0: '0', y0: '0', x1: '4', y1: '10', x: '1', xUnit: 's', yUnit: 'm' },
  'sampled-series-integration': { dataClass: 'synthetic', spacing: '1', ordinates: ['0', '1', '4'], xUnit: 's', yUnit: 'm/s' },
  'evidence-conflict-comparator': { dataClass: 'synthetic', claimId: 'claim-1', population: 'population-a', outcome: 'outcome-a', observations: [
    { observationId: 'obs-1', normalizedClaimId: 'claim-1', direction: 'supports', population: 'population-a', outcome: 'outcome-a', sourceId: 'source-1', exactLocator: 'Table 1' },
    { observationId: 'obs-2', normalizedClaimId: 'claim-1', direction: 'opposes', population: 'population-a', outcome: 'outcome-a', sourceId: 'source-2', exactLocator: 'Table 2' },
  ] },
  'release-bound-evidence-packet': { dataClass: 'public', canonicalUrl: 'https://policy.mahastrategies.com/policy/assurance-cases/definition', expectedContentDigest: 'sha256:6e76356affec2fa3aa97a80acdb26201290743c724c140bd473ca4b290e5d5b0', expectedReleaseDigest: 'sha256:9db3d81aef6e54eeadefde596bcf1920a3f4448a45d697db3e47b7089d89c009' },
  'tiruvaymoli-context-packet': { dataClass: 'public', slug: 'knowledge-and-unknowability-2791-2801', expectedRegistryDigest: 'sha256:98f42d289673bcd6e8c4499377fc1599d8e3f62a416cf4ced02ecbb4f3f98274' },
  'astrology-experiment-plan-check': { dataClass: 'synthetic', assessedAtUtc: '2026-09-09T10:00:00.000Z', startUtc: '2026-09-10T10:00:00.000Z', endUtc: '2026-09-11T10:00:00.000Z', activity: 'synthetic-task', predictorId: 'declared-predictor-1', conventionVersion: 'declared-convention-v1', outcomeId: 'puzzle-score', direction: 'higher', comparator: 'shuffled-timing', sampleSize: 40, analysis: { metric: 'mean-difference', missingData: 'report-and-exclude', stoppingRule: 'fixed-sample', multipleTesting: 'single-primary-outcome', planDigest: hash('3') } },
}
