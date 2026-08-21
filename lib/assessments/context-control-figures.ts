import { WSO2_LIVE_EVIDENCE_PATHS, loadWso2LiveEvidence } from '../integrations/wso2-live-evidence.ts'

import { groupDigits, type SampleAssessment } from './context-control-sample.ts'

/**
 * The set of measurement literals the document is allowed to contain.
 *
 * Built from the committed evidence rather than from the document, so a figure
 * that was typed into the generator by hand -- which regeneration would happily
 * reproduce byte-for-byte -- still fails.
 */
export function collectDerivedFigures(model: SampleAssessment): Set<string> {
  const evidence = loadWso2LiveEvidence()
  const allowed = new Set<string>()
  const add = (value: string | number): void => {
    const text = String(value)
    allowed.add(text)
    if (/^\d+$/.test(text)) allowed.add(groupDigits(Number(text)))
  }

  for (const path of WSO2_LIVE_EVIDENCE_PATHS) {
    const aggregate = evidence.aggregates[path]
    add(aggregate.providerInputTokens)
    add(aggregate.providerOutputTokens)
    add(aggregate.costUsd)
    add(aggregate.calls)
    add(aggregate.successfulCalls)
    add(aggregate.bypassCount)
    for (const latency of Object.values(aggregate.latencyMs)) add(latency)
    for (const score of [aggregate.deterministicFacts, aggregate.adjudicatedFacts]) {
      add(score.answered); add(score.total)
    }
    add(aggregate.expectedCitationLinks.resolved)
    add(aggregate.expectedCitationLinks.total)
  }

  add(evidence.comparison.inputTokenReductionPercent)
  add(evidence.comparison.costReductionPercent)
  add(evidence.workloads.length)
  add(model.corpus.callCount)
  add(model.corpus.requiredFactCount)
  add(model.corpus.expectedCitationCount)
  for (const count of Object.values(model.corpus.difficulties)) add(count)
  add(model.tokensAvoided.replace(/,/g, ''))
  add(model.costAvoidedUsd.replace('$', ''))
  add(model.successfulCalls)
  add(model.prohibitedAssertions)
  add(model.bypassEngaged)

  // Configuration values are measurements of the run's setup and are quoted.
  const configuration = model.configuration
  add(configuration.gatewayVersion)
  add(configuration.promptCompressorVersion)
  add(configuration.promptCompressorRetainedRatio)
  add(configuration.mahaInterceptorVersion)
  add(configuration.temperature)
  add(configuration.maxOutputTokens)
  add(configuration.automaticRetries)
  add(configuration.pricingAssumptionUsdPerMillionTokens.input)
  add(configuration.pricingAssumptionUsdPerMillionTokens.output)

  add(model.failure.liveProviderCalls)
  add(model.failure.timeoutMillis)
  add(model.failure.repetitionsPerScenario)
  for (const entry of model.failure.cases) {
    for (const digits of entry.observedStatus.match(/\d+/g) ?? []) add(digits)
  }

  add(model.trace.documentCount)
  add(model.trace.sourceBytes.replace(/,/g, ''))
  for (const row of model.trace.rows) {
    add(row.inputTokens.replace(/,/g, ''))
    add(row.outputTokens.replace(/,/g, ''))
    add(row.latencyMs.replace(/[^\d]/g, ''))
    add(row.modeledCostUsd.replace('$', ''))
  }
  return allowed
}

/**
 * Structural numbers that are not measurements: section numbers, the enumerated
 * steps in the recommendation, the "3 paths" arithmetic, and the corpus size
 * band quoted from its own description.
 */
const STRUCTURAL = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '256', '20', '100', '4180'])

export function unsupportedFigures(markdown: string, allowed: Set<string>): string[] {
  const unsupported = new Set<string>()
  // Digests, file paths, command lines and code spans are identifiers, not
  // measurements, so they are removed before the scan.
  const prose = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\bsha256:[0-9a-f]+/g, ' ')
    .replace(/\b[0-9a-f]{32,}\b/g, ' ')
    .replace(/\b20\d\d-\d\d-\d\d\b/g, ' ')
    .replace(/20K-100K/g, ' ')
    // Semantic versions are identifiers; scanning them yields fragments like
    // "1.1" that mean nothing and can never be "derived".
    .replace(/\b\d+\.\d+\.\d+\b/g, ' ')
    // Percentile labels name a statistic rather than reporting one.
    .replace(/\bp(?:50|95)\b/g, ' ')

  // Thousands separators only where they are actually grouping, so a list
  // comma never becomes part of the number.
  for (const match of prose.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const literal = match[0]
    if (allowed.has(literal) || allowed.has(literal.replace(/,/g, ''))) continue
    if (STRUCTURAL.has(literal)) continue
    unsupported.add(literal)
  }
  return [...unsupported].sort()
}
