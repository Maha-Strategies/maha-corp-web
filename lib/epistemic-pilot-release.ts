import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from './quantum-systems-graph.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from './synthetic-biology-graph.ts'
import { epistemicRecordPath } from './epistemic-publication.ts'

export const EPISTEMIC_PILOT_RELEASE_RECORDS = [
  ...QUANTUM_SYSTEMS_GRAPH_RECORDS,
  ...SYNTHETIC_BIOLOGY_GRAPH_RECORDS,
] as const

export const EPISTEMIC_PILOT_RELEASE_ROUTES = EPISTEMIC_PILOT_RELEASE_RECORDS.map(epistemicRecordPath)

export const EPISTEMIC_PILOT_WITHHELD_HYPOTHESES = [
  {
    recordId: 'urn:maha:record:fault-tolerant-industrial-advantage',
    title: 'Fault-tolerant industrial advantage',
    path: '/knowledge/quantum-systems/hypotheses/fault-tolerant-industrial-advantage',
  },
  {
    recordId: 'urn:maha:record:general-clinical-readiness-prime-editing',
    title: 'General clinical readiness of prime editing',
    path: '/knowledge/synthetic-biology/hypotheses/general-clinical-readiness-prime-editing',
  },
] as const

export function getEpistemicPilotDomainLifecycle(
  domainSlug: string,
  publicRecordIds: ReadonlySet<string>,
) {
  const candidates = EPISTEMIC_PILOT_RELEASE_RECORDS.filter((record) => record.domainSlug === domainSlug)
  const canonical = candidates.filter((record) => publicRecordIds.has(record.id))
  const active = candidates.length > 0 && canonical.length === candidates.length

  return {
    status: active ? 'active-structured-domain' as const : 'adversarial-pilot' as const,
    foundationalTarget: candidates.length,
    canonicalFactoryRecords: canonical.length,
    outstandingFactoryRecords: candidates.length - canonical.length,
  }
}
