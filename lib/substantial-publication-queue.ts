import { EPISTEMIC_RECORDS } from './epistemic-pilots.ts'
import { epistemicRecordPath, epistemicReviewTargetHash, sha256Canonical } from './epistemic-publication.ts'
import { alignmentBlockers } from './frontier-source-alignment.ts'
import { isPilotAlignmentClear, pilotAlignmentFor } from './pilot-source-alignment.ts'
import { REPAIRED_REVISION_CANARY_RECORDS } from './repaired-revision-canary-targets.ts'
import { SUBSTANTIAL_PUBLICATION_RECORD_IDS } from './substantial-page-publication.ts'
import { SUBSTANTIAL_BATCH_2_RECORD_IDS } from './substantial-page-publication-batch-2.ts'
import { SUBSTANTIAL_BATCH_3_RELEASES } from './substantial-page-publication-batch-3.ts'

export const SUBSTANTIAL_PUBLICATION_QUEUE_VERSION = 'maha-substantial-publication-queue/1.0' as const
export const FROZEN_RELEASE_REGISTRY_SOURCE = 'https://www.mahastrategies.com/knowledge/epistemic-system/releases/registry.json' as const
export const FROZEN_RELEASE_REGISTRY_GENERATED_AT = '2026-08-30T09:07:22.828Z' as const
export const FROZEN_RELEASE_REGISTRY_SHA256 = 'sha256:48f0f8c4a4cb5ce297523bbddfcd7fc0e3f9532b91e66210e84b572b0fb961d0' as const

const REQUIRED_REVIEW_SCOPES = ['boundary-adequacy', 'domain-fidelity', 'rights-and-locator', 'source-fidelity'] as const

type ReleaseTuple = readonly [recordId: string, releaseId: string, targetSha256: string, canonicalPath: string]

/**
 * Sanitized active-release projection frozen from the public registry. The
 * source snapshot contained 47 releases: 46 active, one superseded and zero
 * withdrawn. Every active release carried all four REQUIRED_REVIEW_SCOPES.
 * Reviewer identity, authority attribution and review prose are deliberately
 * absent from this build input.
 */
const ACTIVE_RELEASE_TUPLES: readonly ReleaseTuple[] = [
  ['urn:maha:record:fusion-plasma-systems-breeding-blanket-test-modules', 'epirelease_125e34f72e9d4296a44eae59f921caed', 'sha256:4e6718f1603760cec3f677744f669991415c5466c982f9c0aae3f6b39824636a', '/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-breeding-blanket-test-modules'],
  ['urn:maha:record:agentic-systems-mcp-tool-deny-by-default', 'epirelease_ec742c5ed8924d4b9f8f3bda5570bb19', 'sha256:bc3682ef4b4613b4cff9c468953c218fb20ebad8786ab8c6cc4bbcc8dccb1a66', '/knowledge/agentic-systems-mcp/concepts/agentic-systems-mcp-human-denial-control-for-tool-invocations'],
  ['urn:maha:record:mechanistic-interpretability-causal-scrubbing', 'epirelease_92b3bb496d074e44a7ba0f906fdf90f0', 'sha256:8fd7d34fe31225012157eb78d84da4c9ffe9d0cad94226f7c27ba6ef83774949', '/knowledge/mechanistic-interpretability/methods/mechanistic-interpretability-causal-scrubbing'],
  ['urn:maha:record:fusion-plasma-systems-disruption-mitigation', 'epirelease_51b0c588e25e4f7eacad737ba89deaf5', 'sha256:8b4e21a4f55757d3ba7f4fc65ce6bc9952168f4707e8d2225d9d0b8b8cea2d21', '/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-disruption-mitigation'],
  ['urn:maha:record:biomolecular-engineering-cell-free-transcription-translation', 'epirelease_f2ee091ec4744210b464b5ec2feea44f', 'sha256:fab0b69c3399c2fc046edf1f5c653a02ddee5445dceb8f9976babc948d1b4547', '/knowledge/biomolecular-engineering/concepts/biomolecular-engineering-cell-free-transcription-translation'],
  ['urn:maha:record:agentic-systems-mcp-context-window-position-effects', 'epirelease_d6268dbcc8784930ac7b9c7154fb07d1', 'sha256:d58c9eff543c9c2b592772bdaac5922c9c4c13460344a52551e9bd80c0b732fc', '/knowledge/agentic-systems-mcp/mechanisms/agentic-systems-mcp-context-window-position-effects'],
  ['urn:maha:record:advanced-materials-hexagonal-boron-nitride-dielectrics', 'epirelease_4cd29a7223db4fd99b118dc96062e9ef', 'sha256:4caa07bb7312f980fff275aec28c5d7169fd1716dbc982b35e91f788071959a1', '/knowledge/advanced-materials/mechanisms/advanced-materials-hexagonal-boron-nitride-dielectrics'],
  ['urn:maha:record:critical-supply-chains-photoacid-generator-supply', 'epirelease_c739be62c75c451c869097143637e2e5', 'sha256:e162b04fef588053f885e1a776241372b62282ee7b4cbb4819cbdb26ca531b69', '/knowledge/critical-supply-chains/comparisons/critical-supply-chains-photoacid-generator-supply'],
  ['urn:maha:record:critical-supply-chains-euv-photoresist-precursors', 'epirelease_c93f2d285cdf4a7f95c798d638b71c08', 'sha256:fef130954c4d695fc52a1cef16a84d5b4dbde317b8003fb37d0f8a7b7583fc46', '/knowledge/critical-supply-chains/measurements/critical-supply-chains-euv-photoresist-precursors'],
  ['urn:maha:record:critical-supply-chains-semiconductor-grade-polysilicon', 'epirelease_79ecc635a76446f484134acc47546e7a', 'sha256:16650f77b62196d4e0646eba40145ce3b81eb1c50f72d0342b1f2b2ae6096c79', '/knowledge/critical-supply-chains/methods/critical-supply-chains-semiconductor-grade-polysilicon'],
  ['urn:maha:record:critical-supply-chains-quartz-crucible-manufacturing', 'epirelease_ddb8847cfa1748a19c374b2b71bc913e', 'sha256:4ea4058077b38e83ffe793f62499517702af9b8c0f9c129ab932833fa897e78e', '/knowledge/critical-supply-chains/mechanisms/critical-supply-chains-quartz-crucible-manufacturing'],
  ['urn:maha:record:critical-supply-chains-high-purity-quartz-deposits', 'epirelease_d9b0cd28c1614fa58192be24afcd2a7a', 'sha256:c667320cf234997948bffc6fef2aefd2133010aed2a0af4d457dad0817fd93c0', '/knowledge/critical-supply-chains/concepts/critical-supply-chains-high-purity-quartz-deposits'],
  ['urn:maha:record:agentic-systems-mcp-mcp-tool-input-schemas', 'epirelease_e4548b3179bc49838ccee244ffa16663', 'sha256:9ef90b56afe42591236f42acf544aa4c6390f01a1285d21968101a2379022779', '/knowledge/agentic-systems-mcp/measurements/agentic-systems-mcp-mcp-tool-input-schemas'],
  ['urn:maha:record:agentic-systems-mcp-mcp-tool-result-contracts', 'epirelease_1975faa375e24ca992a78548c6260168', 'sha256:29e3e05e98eb67e9d0e6543b2bb7cbada7af1c622aaebdef0e4eb46e118ff631', '/knowledge/agentic-systems-mcp/comparisons/agentic-systems-mcp-mcp-tool-result-contracts'],
  ['urn:maha:record:agentic-systems-mcp-mcp-tool-discovery', 'epirelease_fc9af8f2bd544c95a5f9bebd8eec7e91', 'sha256:7b3e606931d1625dd96ab951f7694d189ca2fba493e3fb0769800be728166d2f', '/knowledge/agentic-systems-mcp/methods/agentic-systems-mcp-mcp-tool-discovery'],
  ['urn:maha:record:agentic-systems-mcp-mcp-capability-negotiation', 'epirelease_05d5ffe2af774b13934ea173e6f0dcc6', 'sha256:04b49adfee9ef25a070060f53ce2b0ce84a57da1c79e77635485c7a8bb60610d', '/knowledge/agentic-systems-mcp/mechanisms/agentic-systems-mcp-mcp-capability-negotiation'],
  ['urn:maha:record:agentic-systems-mcp-mcp-client-server-roles', 'epirelease_d63350c4ac6642deb732ffe994518fa7', 'sha256:1db697ac8f4127a2423be668d9ae89fb658a579034d213d0241d9ad3ea299d9d', '/knowledge/agentic-systems-mcp/concepts/agentic-systems-mcp-mcp-client-server-roles'],
  ['urn:maha:record:mechanistic-interpretability-representation-probing-boundary', 'epirelease_93c92eb7a317465b83fabf8d3e6962da', 'sha256:83339b28fdea2a81504e0bf44f9229fe06b24e444c774c0a0d513cf1b0bc8b3f', '/knowledge/mechanistic-interpretability/comparisons/mechanistic-interpretability-representation-probing-boundary'],
  ['urn:maha:record:mechanistic-interpretability-superposition-geometry', 'epirelease_ed697c0ba5494993b0743d696709515d', 'sha256:01b8119df53e3368bc49bc8975233b1931223b7b50cd3df9e18ebce4a68f39c1', '/knowledge/mechanistic-interpretability/measurements/mechanistic-interpretability-superposition-geometry'],
  ['urn:maha:record:mechanistic-interpretability-toy-models-of-superposition', 'epirelease_a67e8b03cb744ab1b23ddc6acadf37a3', 'sha256:a984a5310affae3ce9141323a019b36a57e03d4e87430b5d82591c391afc908e', '/knowledge/mechanistic-interpretability/methods/mechanistic-interpretability-toy-models-of-superposition'],
  ['urn:maha:record:mechanistic-interpretability-polysemantic-neurons', 'epirelease_9358ae269fab40c8bfb92a15984a99cb', 'sha256:0ff0aff68c87fff92e7cc21e61a0e60da55ba57e5bc4199fc0d6f8ee11da78ad', '/knowledge/mechanistic-interpretability/mechanisms/mechanistic-interpretability-polysemantic-neurons'],
  ['urn:maha:record:mechanistic-interpretability-neural-feature-superposition', 'epirelease_766f03e214444d6bb06ebcf49b38dddd', 'sha256:05a72058cb2682388462fcf950bdd95334b41c6ad0869a5e0f457d3c505eacea', '/knowledge/mechanistic-interpretability/concepts/mechanistic-interpretability-neural-feature-superposition'],
  ['urn:maha:record:neurotechnology-bci-spike-sorting-boundaries', 'epirelease_7e2cbf17b2114b1a83efe639f290c606', 'sha256:0438a6ef58edff4d00d9b5cf1b4c9fa2aff72136c4233c85cdc41885956dd0e8', '/knowledge/neurotechnology-bci/comparisons/neurotechnology-bci-spike-sorting-boundaries'],
  ['urn:maha:record:neurotechnology-bci-extracellular-spike-recording', 'epirelease_68a3c152fa1343e2b3242ee3ad6aebd3', 'sha256:b69db4c70696ecb4cb4870c44fa90c1d2b127709311c42295b784ff807ebbf4c', '/knowledge/neurotechnology-bci/measurements/neurotechnology-bci-extracellular-spike-recording'],
  ['urn:maha:record:neurotechnology-bci-neuropixels-channel-selection', 'epirelease_a187a969073e438b9392f29649947a0e', 'sha256:fab1beaad2d0c9b53deca84649e83172b14d6043dc376b589c0f8fb6ded8a31d', '/knowledge/neurotechnology-bci/methods/neurotechnology-bci-neuropixels-channel-selection'],
  ['urn:maha:record:neurotechnology-bci-neuropixels-recording-sites', 'epirelease_7d7e421176a14205b8f2595f39e1ca0c', 'sha256:2399e9bc0abd97975dd6019b2f42dd1f38873f91cb36ce407179fad2b702d4a3', '/knowledge/neurotechnology-bci/mechanisms/neurotechnology-bci-neuropixels-recording-sites'],
  ['urn:maha:record:neurotechnology-bci-neuropixels-cmos-probe', 'epirelease_e825250db8ca431eb4f0616c5361b1c2', 'sha256:cd4d0ea320bbcb0d85312ee0cb16d2a52fbf4c480553a310e35a39d7376b3d75', '/knowledge/neurotechnology-bci/concepts/neurotechnology-bci-neuropixels-cmos-probe'],
  ['urn:maha:record:longevity-metabolism-p62-sqstm1-turnover', 'epirelease_06f942051b6448b7a48e3a4ccd9a0876', 'sha256:ed83383369888b5e9940c582d112890a656b507536b84b62911d91265350de1b', '/knowledge/longevity-metabolism/comparisons/longevity-metabolism-p62-sqstm1-turnover'],
  ['urn:maha:record:longevity-metabolism-lc3-turnover-assays', 'epirelease_0eb6f5296fba403b8a034b3b79d25956', 'sha256:d41e23431b7c29de0a5301bdaa86aef0a388ad6492f39a4ce6a75bb1d90dc62d', '/knowledge/longevity-metabolism/measurements/longevity-metabolism-lc3-turnover-assays'],
  ['urn:maha:record:longevity-metabolism-lysosomal-degradation-blockade', 'epirelease_23339b67f1124139b20cebc1e0dd6703', 'sha256:b80c01dc2ee3043a7d76441470570ee28019ee3f73f7ad5707128a38d890c794', '/knowledge/longevity-metabolism/methods/longevity-metabolism-lysosomal-degradation-blockade'],
  ['urn:maha:record:longevity-metabolism-autophagosome-abundance', 'epirelease_544aa352bd1e4db38bee41a97f03b34a', 'sha256:ca4b5b97fcdd716e0e9a9cc9bbb468104e24cce2673595f12ac60a45f8cc7740', '/knowledge/longevity-metabolism/concepts/longevity-metabolism-autophagosome-abundance'],
  ['urn:maha:record:longevity-metabolism-autophagic-flux', 'epirelease_0ec7c21d98e14b4fb8f01fdc65c4064b', 'sha256:1db5eca0f68681c48646e0d05ca7a71241751ba1d68c64e36b21fefe08ba75d6', '/knowledge/longevity-metabolism/mechanisms/longevity-metabolism-autophagic-flux'],
  ['urn:maha:record:biomolecular-engineering-structure-prediction-filtering', 'epirelease_9bf9b14ec8fb48f884efdc43e44ea349', 'sha256:2f59ecb93f3ad9418b05e01058d2d629fff5368dcc20b838b0e996f651c1db50', '/knowledge/biomolecular-engineering/comparisons/biomolecular-engineering-structure-prediction-filtering'],
  ['urn:maha:record:biomolecular-engineering-de-novo-binder-design', 'epirelease_6fd619c2bdc54cedbd99e0ff01493e77', 'sha256:344b491e9fa3317829d3e8b48d5432c80d6804b15ffce2f25a814770966ac298', '/knowledge/biomolecular-engineering/measurements/biomolecular-engineering-de-novo-binder-design'],
  ['urn:maha:record:biomolecular-engineering-motif-scaffolding', 'epirelease_8ffb8cdb8d7841338d8ae69da6fd6eea', 'sha256:ca5e57a43f41f13e0dc0f97c84795152690e1d0bc8fca68488ac2390881a69b9', '/knowledge/biomolecular-engineering/methods/biomolecular-engineering-motif-scaffolding'],
  ['urn:maha:record:biomolecular-engineering-unconditional-protein-generation', 'epirelease_1abe7d4c72cc4e40a9b2105d4b5060a3', 'sha256:209f894eea44050079eb00fc6c0c3302e9cc362929409d23071f8327805c5153', '/knowledge/biomolecular-engineering/mechanisms/biomolecular-engineering-unconditional-protein-generation'],
  ['urn:maha:record:advanced-materials-twist-angle-control', 'epirelease_78e17a346f864314833c54ab2cf0b22b', 'sha256:9a9750914fe0e9429a51dff02b586d4683dec4f1c80cc0d28c7195230330e9cf', '/knowledge/advanced-materials/comparisons/advanced-materials-twist-angle-control'],
  ['urn:maha:record:biomolecular-engineering-protein-backbone-diffusion', 'epirelease_8fae1d3dd4fb47f38669ee6d09bbdbf9', 'sha256:3cc68d1076df1887eff88d393f6d363cfd01d641020d617bbe30c6c8062bd19f', '/knowledge/biomolecular-engineering/concepts/biomolecular-engineering-protein-backbone-diffusion'],
  ['urn:maha:record:advanced-materials-moire-superlattices', 'epirelease_377b82cd521742d79bcbfce0ccc14270', 'sha256:e068e9be179055bd276018d4cb160973d97b543ead4a2658066d1af11da7417e', '/knowledge/advanced-materials/measurements/advanced-materials-moire-superlattices'],
  ['urn:maha:record:advanced-materials-graphene-hbn-heterostructures', 'epirelease_cf7d30fd107544bb8cf80ef1d184e5b6', 'sha256:089357ea824544d5dae02a72384bb9eefea284e439771650d6e60b768ca3c144', '/knowledge/advanced-materials/methods/advanced-materials-graphene-hbn-heterostructures'],
  ['urn:maha:record:fusion-plasma-systems-central-solenoid-inductive-drive', 'epirelease_3b68423488824f7da4c589d6f3303186', 'sha256:fa5b7b661950b82803b045a193a45bfae672d0ce82d724ebb0de856b6e17390e', '/knowledge/fusion-plasma-systems/comparisons/fusion-plasma-systems-central-solenoid-inductive-drive'],
  ['urn:maha:record:advanced-materials-graphene-monolayers', 'epirelease_bd3e9f2b9b0f4814acc35c11e17ec7fa', 'sha256:fe94138dd99d5ff79c9b69762b7039f9a84eefb7f8998841a423aaf125302fdf', '/knowledge/advanced-materials/concepts/advanced-materials-graphene-monolayers'],
  ['urn:maha:record:fusion-plasma-systems-poloidal-field-coils', 'epirelease_afe68aa49787455ab04c756d78252460', 'sha256:008185ca5a3bfbc8c334dac858833b90ac28d51fb79e83c9dfc4378ec229a8c0', '/knowledge/fusion-plasma-systems/measurements/fusion-plasma-systems-poloidal-field-coils'],
  ['urn:maha:record:fusion-plasma-systems-tokamak-plasma-equilibrium', 'epirelease_8e947374097d4695815dbf9ab653177b', 'sha256:cb41216cd3cf8fdc36decedf66f8e768a25b450969b763e83c3d2b756ae57052', '/knowledge/fusion-plasma-systems/mechanisms/fusion-plasma-systems-tokamak-plasma-equilibrium'],
  ['urn:maha:record:fusion-plasma-systems-toroidal-field-coils', 'epirelease_8db6cd549d284a37b2f7cdfe3db93296', 'sha256:d7e7bde1bff5741e7dcb41c341c51f3d2fdb5bd081d063af2dd9a04207508e51', '/knowledge/fusion-plasma-systems/methods/fusion-plasma-systems-toroidal-field-coils'],
  ['urn:maha:record:fusion-plasma-systems-magnetic-confinement', 'epirelease_5d7334bba6ed4170ba8266f2464bc1fb', 'sha256:1a66b69d5429123c71e8a1f6665a5dea0a49deb410c02c3d64ef461fb4a411aa', '/knowledge/fusion-plasma-systems/concepts/fusion-plasma-systems-magnetic-confinement'],
] as const

export interface FrozenActiveRelease {
  recordId: string
  releaseId: string
  targetSha256: string
  canonicalPath: string
  approvalScopes: readonly string[]
}

export const FROZEN_ACTIVE_RELEASES: readonly FrozenActiveRelease[] = ACTIVE_RELEASE_TUPLES.map(
  ([recordId, releaseId, targetSha256, canonicalPath]) => ({
    recordId, releaseId, targetSha256, canonicalPath, approvalScopes: REQUIRED_REVIEW_SCOPES,
  }),
)

const records = new Map([...EPISTEMIC_RECORDS, ...REPAIRED_REVISION_CANARY_RECORDS].map((record) => [record.id, record]))
const currentSubstantialRecordIds = new Set([
  ...SUBSTANTIAL_PUBLICATION_RECORD_IDS,
  ...SUBSTANTIAL_BATCH_2_RECORD_IDS,
  ...SUBSTANTIAL_BATCH_3_RELEASES.map((release) => release.recordId),
])

function sourceAlignmentClear(recordId: string): boolean {
  return pilotAlignmentFor(recordId) ? isPilotAlignmentClear(recordId) : alignmentBlockers(recordId).length === 0
}

export interface PublicationQueueEntry {
  recordId: string
  releaseId: string
  recordFound: boolean
  inspectedAndAlignmentClear: boolean
  exactRevisionReviewed: boolean
  activeCanonicalRelease: boolean
  releaseRevisionMatchesRecord: boolean
  releasePathMatchesRecord: boolean
  currentSubstantialPage: boolean
  eligibleForBatch5: boolean
  blockerCodes: readonly string[]
  queueDigest: string
}

export interface PublicationGateFacts {
  recordFound: boolean
  inspectedAndAlignmentClear: boolean
  exactRevisionReviewed: boolean
  activeCanonicalRelease: boolean
  releaseRevisionMatchesRecord: boolean
  releasePathMatchesRecord: boolean
}

export function publicationGateBlockers(facts: PublicationGateFacts): string[] {
  const blockers: string[] = []
  if (!facts.recordFound) blockers.push('record-missing')
  if (!facts.inspectedAndAlignmentClear) blockers.push('source-not-inspected-or-alignment-blocked')
  if (!facts.exactRevisionReviewed) blockers.push('exact-revision-review-incomplete')
  if (!facts.activeCanonicalRelease) blockers.push('active-canonical-release-missing')
  if (!facts.releaseRevisionMatchesRecord) blockers.push('active-release-revision-stale')
  if (!facts.releasePathMatchesRecord) blockers.push('active-release-path-mismatch')
  return blockers.sort()
}

function queueEntry(release: FrozenActiveRelease): PublicationQueueEntry {
  const record = records.get(release.recordId)
  const scopes = new Set(release.approvalScopes)
  const inspectedAndAlignmentClear = Boolean(record && sourceAlignmentClear(record.id))
  const exactRevisionReviewed = REQUIRED_REVIEW_SCOPES.every((scope) => scopes.has(scope))
  const releaseRevisionMatchesRecord = Boolean(record && epistemicReviewTargetHash(record) === release.targetSha256)
  const releasePathMatchesRecord = Boolean(record && epistemicRecordPath(record) === release.canonicalPath)
  const currentSubstantialPage = currentSubstantialRecordIds.has(release.recordId)
  const activeCanonicalRelease = true
  const blockers = publicationGateBlockers({
    recordFound: Boolean(record),
    inspectedAndAlignmentClear,
    exactRevisionReviewed,
    activeCanonicalRelease,
    releaseRevisionMatchesRecord,
    releasePathMatchesRecord,
  })
  const base = {
    recordId: release.recordId,
    releaseId: release.releaseId,
    recordFound: Boolean(record),
    inspectedAndAlignmentClear,
    exactRevisionReviewed,
    activeCanonicalRelease,
    releaseRevisionMatchesRecord,
    releasePathMatchesRecord,
    currentSubstantialPage,
    // An existing substantial page is descriptive, not a publication gate.
    // New pages may enter only when evidence, exact-revision review and the
    // active release all match; requiring a prior page would make the factory
    // incapable of adding a genuinely new released record.
    eligibleForBatch5: blockers.length === 0,
    blockerCodes: blockers.sort(),
  }
  return { ...base, queueDigest: sha256Canonical(base) }
}

export const SUBSTANTIAL_PUBLICATION_QUEUE: readonly PublicationQueueEntry[] = FROZEN_ACTIVE_RELEASES.map(queueEntry)
export const SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS = SUBSTANTIAL_PUBLICATION_QUEUE
  .filter((entry) => entry.eligibleForBatch5)
  .map((entry) => entry.recordId)
  .sort()

if (FROZEN_ACTIVE_RELEASES.length !== 46 || SUBSTANTIAL_BATCH_5_SELECTED_RECORD_IDS.length !== 34) {
  throw new Error('Batch 5 frozen release or eligible queue count drifted.')
}
