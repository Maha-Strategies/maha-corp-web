import { z } from 'zod'
import { input, records, id, digest, spec, hash, unique, finding as f, metric as m } from './batch5-core.ts'
import { scienceRecordSuite, measurementAudits, type SciencePolicy } from './batch11-science-core.ts'
import { rational } from './batch13-material-core.ts'
import { framedMeasurementAudits } from './batch15-framed-measurements.ts'

const category = 'neural-interface-records', prefix = category + '-'
const boundary = 'Bounded synthetic evaluation counts or public nonpersonal algorithm-configuration metadata only. No raw EEG, participant/session identifiers, individual neural features, diagnosis, training, brain-state inference, hardware acquisition or command/control. Model/calibration/source pins and held-out labels are caller declarations, not independently verified execution, scientific validation or human-performance evidence.'
const pins = { datasetRef: id, simulationRef: id, modelDigest: digest, calibrationDigest: digest, pipelineRevision: digest, featureSchemaDigest: digest, recordsDigest: digest, scopeRef: id }
const row = { id: 'feature1', datasetRef: 'dataset1', simulationRef: 'simulation-synthetic1', modelDigest: hash, calibrationDigest: hash, pipelineRevision: hash, featureSchemaDigest: hash, recordsDigest: hash, scopeRef: 'public-metadata' }
const units = ['hertz', 'kilohertz', 'microvolts', 'millivolts', 'ratio', 'percent', 'milliseconds', 'seconds'] as const
const policy: SciencePolicy = { category, noun: 'synthetic neural-interface model/calibration/pipeline metadata', boundary, pins, sample: row, owner: 'datasetRef', subject: 'simulationRef', revision: 'pipelineRevision', content: 'recordsDigest', units, unitMeaning: 'synthetic neural evaluation quantities' }
const frame = { datasetRef: id, simulationRef: id, modelDigest: digest, calibrationDigest: digest, pipelineRevision: digest, featureSchemaDigest: digest }
const sampleFrame = { id: 'm1', datasetRef: row.datasetRef, simulationRef: row.simulationRef, modelDigest: hash, calibrationDigest: hash, pipelineRevision: hash, featureSchemaDigest: hash }
const numeric = framedMeasurementAudits({ category, boundary, frame, sample: sampleFrame, quantities: ['sample-rate', 'amplitude', 'probability', 'latency'], units,
  compatible: { 'sample-rate': ['hertz', 'kilohertz'], amplitude: ['microvolts', 'millivolts'], probability: ['ratio', 'percent'], latency: ['milliseconds', 'seconds'] }, sampleQuantity: 'sample-rate', sampleUnit: 'hertz' })
const timeAudit = measurementAudits({ category, noun: 'synthetic neural metadata exports only', quantities: ['sample-rate', 'amplitude', 'probability', 'latency'], units, compatible: { 'sample-rate': ['hertz', 'kilohertz'], amplitude: ['microvolts', 'millivolts'], probability: ['ratio', 'percent'], latency: ['milliseconds', 'seconds'] }, sampleQuantity: 'sample-rate', sampleUnit: 'hertz' }).find(s => s.id.endsWith('timestamp-order-audit'))!
const count = z.number().int().min(0).max(1e6).nullable()
const evaluation = { id: 'eval1', modelDigest: hash, calibrationDigest: hash, pipelineRevision: hash, labelsFrozenBeforeEvaluation: true, restWindows: 100, restFalseCommandWindows: 1, intentionWindows: 10, detectedIntentionWindows: 8, missedIntentionWindows: 2 }
const conditions = spec(prefix + 'condition-coverage-map', 'Check synthetic binary window-count accounting in one declared model/calibration/pipeline frame and derive exact rest false-command-window fraction and intention missed-window fraction. Require labels declared frozen before evaluation, known integer counts, positive denominators, rest false windows no greater than rest windows, and detected+missed intention windows equal the declared total. This is NOT false commands per hour, a downstream quality test, verified held-out evaluation or real participant performance. At most one binary outcome per window is assumed. ' + boundary,
  input({ dataClass: z.literal('synthetic'), datasetRef: id, simulationRef: id, modelDigest: digest, calibrationDigest: digest, pipelineRevision: digest, rows: records({ modelDigest: digest, calibrationDigest: digest, pipelineRevision: digest, labelsFrozenBeforeEvaluation: z.boolean(), restWindows: count, restFalseCommandWindows: count, intentionWindows: count, detectedIntentionWindows: count, missedIntentionWindows: count }) }),
  { datasetRef: row.datasetRef, simulationRef: row.simulationRef, modelDigest: hash, calibrationDigest: hash, pipelineRevision: hash, rows: [evaluation] },
  { datasetRef: row.datasetRef, simulationRef: row.simulationRef, modelDigest: hash, calibrationDigest: hash, pipelineRevision: hash, rows: [{ ...evaluation, labelsFrozenBeforeEvaluation: false }] },
  [prefix + 'labels-not-frozen-declared', prefix + 'evaluation-frame-mismatch', prefix + 'counts-not-known', prefix + 'denominator-zero', prefix + 'binary-counts-inconsistent'],
  [prefix + 'synthetic-evaluations-derived', prefix + 'rest-false-window-fraction', prefix + 'intention-missed-window-fraction'], i => {
    unique(i.rows.map(r => r.id)); let derived = 0; const metrics: ReturnType<typeof m>[] = []
    const findings = i.rows.flatMap(r => {
      if (r.modelDigest !== i.modelDigest || r.calibrationDigest !== i.calibrationDigest || r.pipelineRevision !== i.pipelineRevision) return [f(prefix + 'evaluation-frame-mismatch', r.id)]
      if (!r.labelsFrozenBeforeEvaluation) return [f(prefix + 'labels-not-frozen-declared', r.id)]
      if (r.restWindows === null || r.restFalseCommandWindows === null || r.intentionWindows === null || r.detectedIntentionWindows === null || r.missedIntentionWindows === null) return [f(prefix + 'counts-not-known', r.id)]
      if (r.restWindows === 0 || r.intentionWindows === 0) return [f(prefix + 'denominator-zero', r.id)]
      if (r.restFalseCommandWindows > r.restWindows || r.detectedIntentionWindows + r.missedIntentionWindows !== r.intentionWindows) return [f(prefix + 'binary-counts-inconsistent', r.id)]
      derived++; metrics.push(m(prefix + 'rest-false-window-fraction', r.id, rational(BigInt(r.restFalseCommandWindows), BigInt(r.restWindows))), m(prefix + 'intention-missed-window-fraction', r.id, rational(BigInt(r.missedIntentionWindows), BigInt(r.intentionWindows)))); return []
    })
    return { findings, metrics: [m(prefix + 'synthetic-evaluations-derived', category, derived), ...metrics] }
  })
// Source coverage already exists in Batch 4 and is deliberately not recounted.
export const BATCH15_NEURAL = scienceRecordSuite(policy, [...numeric, timeAudit, conditions]).filter(s => s.id !== prefix + 'source-coverage-map')
