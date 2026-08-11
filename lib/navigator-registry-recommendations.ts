import { createHash } from 'node:crypto'

import { NAVIGATOR_RUBRIC_KEY, NAVIGATOR_RUBRIC_VERSION, parseNavigatorCandidate, type NavigatorCandidateInput } from './maha-navigator-research.ts'
import type { NavigatorRegistryRecord } from './navigator-registry-sources.ts'

function compact(value: string, maximum: number): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length <= maximum ? line : `${line.slice(0, maximum - 1).trim()}…`
}

function registryLabel(record: NavigatorRegistryRecord): string {
  return record.registry === 'bazaar' ? 'Coinbase Bazaar'
    : record.registry === 'payan' ? 'PayanAgent'
      : record.registry === 'mcp' ? 'the official MCP Registry' : 'a public A2A Agent Card'
}

export function recommendationFromRegistry(record: NavigatorRegistryRecord): NavigatorCandidateInput {
  const label = registryLabel(record)
  // A self-published A2A card is primary evidence of its own declaration.
  // Marketplace and registry entries are attributable but remain secondary
  // evidence about the account behind the listing.
  const sourceQuality = record.registry === 'a2a' ? 'primary' : 'credible_secondary'
  const capability = compact(record.capabilities.slice(0, 3).join('; ') || record.description, 500)
  const dated = record.sourcePublishedOn
    ? `${label} records a publication or update on ${record.sourcePublishedOn}. This is a dated deployment signal, not evidence that the account intends to buy.`
    : `The ${label} record was observed on ${record.observedOn}, but it exposes no reliable publication date. Timing and purchase intent remain unverified.`
  const idempotency = createHash('sha256').update(`${record.registry}:${record.listingId}:${NAVIGATOR_RUBRIC_VERSION}`).digest('hex').slice(0, 32)
  return parseNavigatorCandidate({
    idempotencyKey: `navigator-registry:${record.registry}:${idempotency}`,
    companyName: record.companyName,
    companyDomain: record.companyDomain,
    rubricKey: NAVIGATOR_RUBRIC_KEY,
    rubricVersion: NAVIGATOR_RUBRIC_VERSION,
    claims: [
      {
        type: 'account_fit', statement: compact(`${record.companyName} publicly exposes ${capability} through ${label}. That supports possible fit with Maha's governed MCP/A2A, payment-safety, auditability, or context-control work; it does not prove a control gap.`, 1_500),
        sourceUrl: record.evidenceUrl, sourcePublishedOn: record.sourcePublishedOn, observedOn: record.observedOn, sourceQuality, confidence: 'medium',
      },
      {
        type: 'buying_trigger', statement: dated,
        sourceUrl: record.evidenceUrl, sourcePublishedOn: record.sourcePublishedOn, observedOn: record.observedOn, sourceQuality, confidence: 'low',
      },
      {
        type: 'likely_owner', statement: `Likely sponsor role (research hypothesis only): the AI platform, agent infrastructure, application security, or developer-platform owner responsible for the published ${record.registry.toUpperCase()} capability. No person or contact address has been inferred.`,
        sourceUrl: record.evidenceUrl, sourcePublishedOn: record.sourcePublishedOn, observedOn: record.observedOn, sourceQuality, confidence: 'low',
      },
      {
        type: 'disqualifier', statement: `Reject, defer, or mark insufficient evidence if human review cannot confirm a live governed workflow, a bounded control problem, and an appropriate sponsor. A public registry listing alone is not contact permission or evidence of demand.`,
        sourceUrl: record.evidenceUrl, sourcePublishedOn: record.sourcePublishedOn, observedOn: record.observedOn, sourceQuality, confidence: 'medium',
      },
    ],
  })
}
