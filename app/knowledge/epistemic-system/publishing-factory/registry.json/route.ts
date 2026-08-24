import {
  evaluatePublicAuthorityConformance,
  loadPublicAuthorityConformanceCorpus,
} from '@/lib/celestial-public-authority-conformance'
import {
  EPISTEMIC_FACTORY_BOUNDARY,
  EPISTEMIC_FACTORY_COMPILER_VERSION,
  EPISTEMIC_FACTORY_VERSION,
  EPISTEMIC_REVIEW_PACKET_VERSION,
} from '@/lib/epistemic-factory'
import { EPISTEMIC_MIGRATION_INVENTORY } from '@/lib/epistemic-adapters'

export const dynamic = 'force-static'

export async function GET() {
  const corpus = await loadPublicAuthorityConformanceCorpus()
  const conformance = evaluatePublicAuthorityConformance(corpus)
  return Response.json({
    schemaVersion: EPISTEMIC_FACTORY_VERSION,
    compilerVersion: EPISTEMIC_FACTORY_COMPILER_VERSION,
    reviewerPacketVersion: EPISTEMIC_REVIEW_PACKET_VERSION,
    phases: {
      phase5: 'immutable automated audits and reviewer packets',
      phase6: 'bounded batch compilation over latest frozen candidates',
      phase7: 'JPL and USNO public-authority calculation conformance',
      phase8: 'dry-run-by-default operator command and append-only provenance',
    },
    capacity: { targetsPerRun: 500, currentAdapterCandidates: EPISTEMIC_MIGRATION_INVENTORY.counts.sourceRecords },
    publicOutputs: {
      methodologyPage: true,
      sanitizedConformanceFixture: true,
      candidatePages: false,
      reviewerPackets: false,
      reviewerIdentities: false,
    },
    conformance: {
      corpusVersion: conformance.corpusVersion,
      authorities: conformance.authorities,
      counts: conformance.counts,
      maxima: conformance.maxima,
      tolerances: conformance.tolerances,
      disagreements: conformance.disagreements,
      privacyBoundary: conformance.privacyBoundary,
      interpretationBoundary: conformance.interpretationBoundary,
    },
    boundary: EPISTEMIC_FACTORY_BOUNDARY,
  }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } })
}
