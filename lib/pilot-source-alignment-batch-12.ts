import type { PilotJudgement } from './pilot-source-alignment.ts'

/**
 * Pilot source-alignment Batch 12.
 *
 * Every entry below records an internal editorial inspection of the declared
 * source content. Publisher abstracts are treated as abstract-level evidence;
 * repository full text is labelled separately and never represented as the
 * version of record. These judgements upgrade only source/subject alignment.
 * They do not represent external review, independent reproduction, canonical
 * release, or a broader scientific conclusion.
 */
export const PILOT_BATCH_12_VERSION = 'maha-pilot-source-alignment-batch-12/1.0' as const
export const PILOT_BATCH_12_INPUT_DATE = '2026-08-30' as const

export const PILOT_BATCH_12_SLUGS = [
  'adenine-base-editing',
  'cell-free-gene-expression',
  'crispr-cas9-nuclease-editing',
  'cytosine-base-editing',
  'directed-evolution-workflows',
  'editing-efficiency-and-byproduct-measurement',
  'genetic-toggle-switch',
  'guide-rna-and-pam-recognition',
  'hardware-benchmark-scope',
  'interleaved-randomized-benchmarking',
  'linear-optical-quantum-computation',
  'logical-error-suppression',
  'neutral-atom-optical-tweezer-arrays',
  'prime-editing',
  'prime-editing-guide-rna-mechanism',
  'quantum-volume-benchmark',
  'randomized-benchmarking',
  'repressilator-gene-oscillator',
  'rydberg-blockade-entangling-gates',
  'silicon-spin-qubits',
  'trapped-ion-qccd-architecture',
] as const

const publisherAbstract = (
  domainSlug: PilotJudgement['domainSlug'],
  sourceContractId: string,
  inspectedContentLocation: string,
  reason: string,
): PilotJudgement => ({
  domainSlug,
  sourceContractId,
  verdict: 'supported',
  metadataVerified: true,
  sourceContentInspected: true,
  inspectedContentLocation,
  artifactVersion: 'version-of-record',
  versionRelationship: 'declared-version-of-record-inspected',
  rightsBasis: 'citation-with-paraphrase',
  reason,
  remediation: 'None. The declared source and bounded record subject align at the inspected publisher abstract.',
})

const repositoryFullText = (
  domainSlug: PilotJudgement['domainSlug'],
  sourceContractId: string,
  inspectedContentLocation: string,
  reason: string,
): PilotJudgement => ({
  domainSlug,
  sourceContractId,
  verdict: 'supported',
  metadataVerified: true,
  sourceContentInspected: true,
  inspectedContentLocation,
  artifactVersion: 'repository-copy',
  versionRelationship: 'repository-copy-of-the-declared-version-of-record',
  rightsBasis: 'citation-with-paraphrase',
  reason,
  remediation:
    'None for source/subject alignment. Preserve the repository-copy version label; do not imply that every version-of-record detail was inspected.',
})

export const PILOT_BATCH_12_JUDGEMENTS: Readonly<Record<(typeof PILOT_BATCH_12_SLUGS)[number], PilotJudgement>> = {
  'adenine-base-editing': repositoryFullText(
    'synthetic-biology',
    'source-gaudelli-abe-2017',
    'PMC5726555 author manuscript, Summary and “Scope and overview of base editing by an A•T to G•C base editor”',
    'The inspected manuscript reports evolution and engineering of adenine base editors and targeted A•T-to-G•C editing in bacteria and named human cell systems, matching the bounded record subject.',
  ),
  'cell-free-gene-expression': repositoryFullText(
    'synthetic-biology',
    'source-noireaux-cell-free-2004',
    'PMC539773 version-of-record repository copy, Abstract and opening methods rationale',
    'The source encapsulates an E. coli cell-free expression system in fed phospholipid vesicles and reports transcription–translation of plasmid genes, directly matching the record.',
  ),
  'crispr-cas9-nuclease-editing': repositoryFullText(
    'synthetic-biology',
    'source-jinek-cas9-2012',
    'PMC6286148 repository copy, Conclusions',
    'The conclusions identify programmable dual-RNA-guided Cas9 cleavage, distinct nuclease domains, and site-specific double-strand breaks, directly supporting the bounded nuclease-editing record.',
  ),
  'cytosine-base-editing': repositoryFullText(
    'synthetic-biology',
    'source-komor-cbe-2016',
    'PMC4873371 author manuscript, article abstract and associated-data record',
    'The inspected manuscript is the declared cytosine-base-editing study and reports construction and testing of programmable target-base editors in named transformed human and murine cell lines.',
  ),
  'directed-evolution-workflows': publisherAbstract(
    'synthetic-biology',
    'source-esvelt-pace-2011',
    'Nature version-of-record page, Abstract lines 35–39',
    'The abstract states that PACE transfers evolving genes through a modified bacteriophage life cycle in E. coli according to target activity and demonstrates continuous selection of T7 RNA polymerase variants.',
  ),
  'editing-efficiency-and-byproduct-measurement': repositoryFullText(
    'synthetic-biology',
    'source-anzalone-prime-2019-graph',
    'PMC6907074 author manuscript, Summary; Figure 2; “Prime editing compared with base editing”',
    'The inspected source reports target- and condition-specific intended edits, indels, efficiencies, and comparisons using specified sequencing readouts; the record retains those experiment-level boundaries.',
  ),
  'genetic-toggle-switch': publisherAbstract(
    'synthetic-biology',
    'source-gardner-toggle-2000',
    'Nature version-of-record page, Abstract lines 34–37',
    'The abstract reports construction of a synthetic bistable toggle in E. coli, transient chemical or thermal switching, stable states, and a measured switching threshold.',
  ),
  'guide-rna-and-pam-recognition': repositoryFullText(
    'synthetic-biology',
    'source-jinek-cas9-2012',
    'PMC6286148 repository copy, Conclusions',
    'The conclusions state that Cas9 recognition requires a crRNA seed sequence and adjacent GG-containing PAM and that an engineered single guide can program cleavage, matching the record.',
  ),
  'hardware-benchmark-scope': publisherAbstract(
    'quantum-systems',
    'source-cross-quantum-volume-2019',
    'Physical Review A version-of-record page, Abstract lines 93–95',
    'The abstract defines quantum volume through a concrete random-circuit protocol and reports its measurement on specified transmon devices, supporting the record’s bounded benchmark-scope claim.',
  ),
  'interleaved-randomized-benchmarking': publisherAbstract(
    'quantum-systems',
    'source-magesan-interleaved-rb-2012',
    'Physical Review Letters version-of-record page, Abstract lines 89–91',
    'The abstract describes interleaving a target gate with random Clifford gates and deriving an estimate and bounds for that gate’s average error under an explicit noise condition.',
  ),
  'linear-optical-quantum-computation': publisherAbstract(
    'quantum-systems',
    'source-klm-linear-optics-2001',
    'Nature version-of-record page, Abstract lines 34–37',
    'The abstract states that efficient quantum computation is possible with beam splitters, phase shifters, single-photon sources, photodetectors, and detector feedback, matching the formal construction record.',
  ),
  'logical-error-suppression': publisherAbstract(
    'quantum-systems',
    'source-google-logical-error-2023',
    'Nature open-access version-of-record page, Abstract lines 38–42',
    'The abstract reports that a distance-5 surface-code logical qubit modestly outperformed distance-3 logical qubits under the stated cycles and device, exactly the bounded comparison in the record.',
  ),
  'neutral-atom-optical-tweezer-arrays': publisherAbstract(
    'quantum-systems',
    'source-bluvstein-neutral-atom-2023',
    'Nature version-of-record page, Abstract lines 58–63',
    'The abstract reports a programmable encoded processor using zoned, reconfigurable neutral-atom arrays, arbitrary connectivity, programmable rotations, and mid-circuit readout.',
  ),
  'prime-editing': repositoryFullText(
    'synthetic-biology',
    'source-anzalone-prime-editing-2019',
    'PMC6907074 author manuscript, Summary',
    'The summary reports targeted substitutions, insertions, and deletions across four human cell lines and primary post-mitotic mouse cortical neurons, with varying efficiencies, directly matching the record.',
  ),
  'prime-editing-guide-rna-mechanism': repositoryFullText(
    'synthetic-biology',
    'source-anzalone-prime-2019-graph',
    'PMC6907074 author manuscript, Figure 1 and “Prime editing strategy”',
    'The inspected mechanism section describes the nickase–reverse-transcriptase fusion, pegRNA target spacer, primer-binding site, and reverse-transcription template that jointly specify the edit.',
  ),
  'quantum-volume-benchmark': publisherAbstract(
    'quantum-systems',
    'source-cross-quantum-volume-2019',
    'Physical Review A version-of-record page, Abstract lines 93–95',
    'The abstract introduces quantum volume, defines it through random circuits of equal width and depth, and reports the protocol on several transmon devices.',
  ),
  'randomized-benchmarking': publisherAbstract(
    'quantum-systems',
    'source-magesan-rb-2011',
    'Physical Review Letters version-of-record page, Abstract lines 86–88',
    'The abstract proposes a scalable protocol, derives fitting models for fidelity decay, and estimates average gate error under a general time- and gate-dependent noise model.',
  ),
  'repressilator-gene-oscillator': publisherAbstract(
    'synthetic-biology',
    'source-elowitz-repressilator-2000',
    'Nature version-of-record page, Abstract lines 33–36',
    'The abstract reports a three-repressor oscillating network in E. coli and periodically induced GFP in individual cells, directly supporting the record.',
  ),
  'rydberg-blockade-entangling-gates': publisherAbstract(
    'quantum-systems',
    'source-evered-rydberg-gates-2023',
    'Nature open-access version-of-record page, Abstract lines 52–56',
    'The abstract reports parallel two-qubit entangling operations mediated through Rydberg interactions, multiple fidelity benchmarks, and demonstrated low-error three-qubit gates.',
  ),
  'silicon-spin-qubits': publisherAbstract(
    'quantum-systems',
    'source-loss-divincenzo-spin-1998',
    'Physical Review A version-of-record page, Abstract lines 97–99',
    'The abstract proposes universal one- and two-qubit gates using spins in coupled single-electron quantum dots and tunnelling-barrier control, with gate-quality calculations and proposed experiments.',
  ),
  'trapped-ion-qccd-architecture': publisherAbstract(
    'quantum-systems',
    'source-pino-qccd-2021',
    'Nature version-of-record page, Abstract lines 43–48',
    'The abstract reports a cryogenic surface-trap QCCD integrating a scalable trap, parallel interaction zones, fast ion transport, programmable operations, and mid-circuit measurement.',
  ),
}

{
  const declared = new Set(PILOT_BATCH_12_SLUGS)
  const judged = Object.keys(PILOT_BATCH_12_JUDGEMENTS)
  if (declared.size !== PILOT_BATCH_12_SLUGS.length) throw new Error('Batch 12 declares a duplicate record slug.')
  if (judged.length !== PILOT_BATCH_12_SLUGS.length) throw new Error('Batch 12 judgement count does not match membership.')
  for (const slug of declared) {
    const judgement = PILOT_BATCH_12_JUDGEMENTS[slug]
    if (!judgement) throw new Error(`${slug} is in Batch 12 membership without a judgement.`)
    if (!judgement.sourceContentInspected || !judgement.inspectedContentLocation) {
      throw new Error(`${slug} cannot enter Batch 12 without inspected content and an exact location.`)
    }
    if (judgement.verdict !== 'supported') throw new Error(`${slug} is not alignment-clear after inspection.`)
  }
}
