import type { PilotJudgement } from './pilot-source-alignment.ts'

/** Full-text quantum pilot inspections; internal editorial work only. */
export const PILOT_BATCH_14_VERSION = 'maha-pilot-source-alignment-batch-14/1.0' as const
export const PILOT_BATCH_14_INPUT_DATE = '2026-08-30' as const
export const PILOT_BATCH_14_SLUGS = [
  'cryogenic-superconducting-control-stack',
  'dispersive-qubit-readout',
  'fault-tolerance-threshold-condition',
  'josephson-junction-nonlinearity',
  'physical-and-logical-qubits',
  'quantum-error-correction',
  'random-circuit-sampling',
] as const

const supported = (
  sourceContractId: string,
  inspectedContentLocation: string,
  reason: string,
  versionRelationship: PilotJudgement['versionRelationship'] = 'repository-copy-of-the-declared-version-of-record',
): PilotJudgement => ({
  domainSlug: 'quantum-systems',
  sourceContractId,
  verdict: 'supported',
  metadataVerified: true,
  sourceContentInspected: true,
  inspectedContentLocation,
  artifactVersion: versionRelationship === 'declared-version-of-record-inspected' ? 'version-of-record' : 'repository-copy',
  versionRelationship,
  rightsBasis: 'citation-with-paraphrase',
  reason,
  remediation: 'None for source/subject alignment. Keep the inspected artifact version and locator explicit.',
})

export const PILOT_BATCH_14_JUDGEMENTS: Readonly<Record<(typeof PILOT_BATCH_14_SLUGS)[number], PilotJudgement>> = {
  'cryogenic-superconducting-control-stack': supported(
    'source-arute-random-circuits-2019',
    'Repository copy of Nature 574, 505–510, “Building a high-fidelity processor”, pp. 1–2 and Figure 3',
    'The article documents sub-20 mK dilution refrigeration, filters and attenuators, room-temperature signal synthesis, multiplexed readout, cryogenic amplification, digitization, control converters, pulse shaping, optimization, and individually calibrated gates.',
  ),
  'dispersive-qubit-readout': supported(
    'source-blais-circuit-qed-2004',
    'arXiv:cond-mat/0402216 full text, §VI “Dispersive QND Readout of Qubit”, especially §VI.1 and Figure 5',
    'The inspected analysis derives qubit-state-dependent cavity pulls and describes readout through the transmitted photon number or phase under explicit dispersive conditions.',
  ),
  'fault-tolerance-threshold-condition': supported(
    'source-fowler-surface-code-2012',
    'Author-hosted manuscript, §VIII “Errors and error correction”, pp. 10–13, Figures 4, 7 and 8',
    'The source explicitly defines the below-threshold condition, reports the architecture-specific per-step threshold, and shows how logical error changes with code distance under its noise model.',
  ),
  'josephson-junction-nonlinearity': supported(
    'source-blais-circuit-qed-2004',
    'arXiv:cond-mat/0402216 full text, §III.2–III.3, equations 15–17, and §IV',
    'The source writes the Cooper-pair-box Hamiltonian in charging and Josephson energies, maps its lowest states to an artificial atom coupled to a resonator, and treats the resulting anharmonic spectrum.',
  ),
  'physical-and-logical-qubits': supported(
    'source-shor-qec-1995',
    'APS version-of-record full text, §III “Encoding”, pp. R2494–R2495',
    'The paper explicitly maps each original qubit into nine physical qubits and explains how the encoded state can be recovered under the stated single-qubit decoherence model.',
    'declared-version-of-record-inspected',
  ),
  'quantum-error-correction': supported(
    'source-shor-qec-1995',
    'APS version-of-record full text, §III “Encoding”, pp. R2494–R2495',
    'The inspected construction gives an explicit nine-qubit encoding, ancilla-assisted error information, and correction under its independent single-qubit decoherence assumption.',
    'declared-version-of-record-inspected',
  ),
  'random-circuit-sampling': supported(
    'source-arute-random-circuits-2019',
    'Repository copy of Nature 574, 505–510, “A suitable computational task”, “Fidelity estimation in the supremacy regime”, and Figure 4',
    'The paper reports pseudo-random circuit sampling on 53 qubits and cross-entropy benchmarking against the corresponding classically simulated circuit probabilities.',
  ),
}

{
  const declared = new Set(PILOT_BATCH_14_SLUGS)
  if (declared.size !== PILOT_BATCH_14_SLUGS.length) throw new Error('Batch 14 declares a duplicate record slug.')
  if (Object.keys(PILOT_BATCH_14_JUDGEMENTS).length !== PILOT_BATCH_14_SLUGS.length) throw new Error('Batch 14 judgement count does not match membership.')
  for (const slug of declared) {
    const judgement = PILOT_BATCH_14_JUDGEMENTS[slug]
    if (!judgement?.sourceContentInspected || !judgement.inspectedContentLocation || judgement.verdict !== 'supported') {
      throw new Error(`${slug} is not an inspected alignment-clear Batch 14 record.`)
    }
  }
}
