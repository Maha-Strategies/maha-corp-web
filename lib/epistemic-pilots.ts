import {
  EPISTEMIC_POLICY_VERSION,
  EPISTEMIC_SCHEMA_VERSION,
  type EpistemicDomain,
  type EpistemicRecord,
  type MathematicalBridge,
} from './epistemic-schema.ts'
import {
  assertGraphIntegrity,
  buildProvenanceBundle,
  epistemicRecordPath,
  evaluatePublicationGate,
} from './epistemic-publication.ts'
import { QUANTUM_SYSTEMS_GRAPH_RECORDS } from './quantum-systems-graph.ts'
import { SYNTHETIC_BIOLOGY_GRAPH_RECORDS } from './synthetic-biology-graph.ts'

export const EPISTEMIC_SYSTEM_PATH = '/knowledge/epistemic-system' as const
export const EPISTEMIC_RELEASE_DATE = '2026-08-24' as const

export const EPISTEMIC_DOMAINS: readonly EpistemicDomain[] = [
  {
    slug: 'quantum-systems',
    name: 'Quantum systems and advanced energy',
    description: 'Physical architectures, control systems, measurements, models, and readiness boundaries kept separate from formal possibility claims.',
    stressPoint: 'Formal mathematics can describe a valid architecture without establishing that a physical implementation is manufacturable, fault tolerant, or commercially ready.',
    accent: 'blue',
  },
  {
    slug: 'synthetic-biology',
    name: 'Synthetic biology and cellular engineering',
    description: 'Molecular tools, cell systems, protocols, measurements, and safety boundaries represented with explicit experimental scope.',
    stressPoint: 'Performance in a cell line, organoid, animal model, and human intervention are different evidence states and cannot be silently collapsed.',
    accent: 'green',
  },
] as const

const canonicalReview = (rationale: string) => ({
  requestedPublicPromotion: true,
  reviewState: 'published-canonical' as const,
  canonicalVersion: '1.0.0',
  publishedAt: EPISTEMIC_RELEASE_DATE,
  lastReviewedAt: `${EPISTEMIC_RELEASE_DATE}T00:00:00.000Z`,
  reviewEvents: [{
    reviewerId: 'maha-editorial-system',
    reviewerRole: 'Phase 1 source-fidelity and boundary review',
    reviewedAt: `${EPISTEMIC_RELEASE_DATE}T00:00:00.000Z`,
    verdict: 'approve' as const,
    rationale,
  }],
})

export const EPISTEMIC_RECORDS: readonly EpistemicRecord[] = [
  {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: 'urn:maha:record:transmon-qubit',
    domainSlug: 'quantum-systems',
    recordKind: 'concept',
    slug: 'transmon-qubit',
    title: 'Transmon qubit',
    description: 'A superconducting qubit design that trades a weak reduction in anharmonicity for an exponential reduction in charge dispersion as the Josephson-to-charging-energy ratio increases.',
    summary: 'The transmon is a design regime of the Cooper-pair-box circuit. This record separates the published circuit model from later claims about coherence, scaling, error correction, fabrication yield, and commercial readiness.',
    claims: [{
      id: 'urn:maha:claim:transmon-energy-ratio',
      statement: 'In the transmon design analysed by Koch and colleagues, increasing the ratio of Josephson energy to charging energy suppresses charge dispersion exponentially while anharmonicity decreases only by a weak power law.',
      claimKind: 'theoretical-model',
      evidenceMaturity: 'single-study',
      sourceIds: ['source-koch-transmon-2007'],
      scope: 'Circuit quantization and numerical analysis of the transmon regime described in the 2007 Physical Review A paper.',
      boundary: 'The model does not by itself establish a fabrication yield, device lifetime, logical error rate, system-scale advantage, or commercially useful fault-tolerant computer.',
      uncertainty: {
        kind: 'qualitative',
        statement: 'The relationship is model- and parameter-dependent; this Phase 1 record does not reproduce a numerical device-specific uncertainty interval.',
      },
      replication: {
        independentReplicationCount: null,
        assessment: 'Independent experimental implementations are outside this bounded source record and are not counted here.',
        asOfDate: EPISTEMIC_RELEASE_DATE,
      },
    }],
    sources: [{
      id: 'source-koch-transmon-2007',
      title: 'Charge-insensitive qubit design derived from the Cooper pair box',
      authors: ['Jens Koch', 'Terri M. Yu', 'Jay Gambetta', 'A. A. Houck', 'D. I. Schuster', 'et al.'],
      publisher: 'Physical Review A, American Physical Society',
      publishedAt: '2007-10-12',
      url: 'https://journals.aps.org/pra/abstract/10.1103/PhysRevA.76.042319',
      identifiers: [{ scheme: 'doi', value: '10.1103/PhysRevA.76.042319' }],
      exactLocator: 'Abstract; Sections II–IV; equations and numerical analysis defining the transmon regime.',
      rights: {
        basis: 'citation-with-paraphrase',
        quotationUsed: false,
        note: 'The Maha page provides original summary and boundary language and links to the publisher record; no article passage is reproduced.',
      },
      establishes: 'The source introduces and analyses the transmon circuit regime, including the different scaling of charge dispersion and anharmonicity with the Josephson-to-charging-energy ratio.',
      boundary: 'It is a design and modelling paper, not proof of later processor-scale fault tolerance, manufacturing economics, or strategic advantage.',
    }],
    sections: [
      {
        heading: 'What the model establishes',
        paragraphs: [
          'The transmon retains the Cooper-pair-box circuit but operates it in a different energy regime. The published analysis shows why charge sensitivity can fall much faster than the circuit loses the anharmonicity required to address transitions selectively.',
          'This is a precise design relationship, not a general declaration that every transmon implementation has long coherence or that a transmon processor is fault tolerant.',
        ],
        claimIds: ['urn:maha:claim:transmon-energy-ratio'],
      },
      {
        heading: 'What must be measured separately',
        paragraphs: [
          'A physical system still requires device-specific measurements of relaxation, dephasing, leakage, gate fidelity, crosstalk, calibration drift, packaging, cryogenic control, fabrication variation, and logical performance.',
          'Those measurements belong in additional records with their own devices, methods, dates, uncertainty, and replication assessments.',
        ],
        claimIds: [],
      },
    ],
    bridges: [],
    boundaries: [
      'A valid circuit model does not establish physical manufacturability or system-level fault tolerance.',
      'Published device metrics cannot be transferred across chips, fabrication processes, control stacks, or operating conditions without a comparison contract.',
    ],
    prohibitedInferences: [
      'Do not infer that superconducting qubits have achieved economically useful fault-tolerant quantum computation.',
      'Do not infer processor advantage from the transmon design relationship alone.',
    ],
    publication: canonicalReview('Approved as a bounded demonstration of how a theoretical model and physical-readiness claims remain separate.'),
  },
  {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: 'urn:maha:record:prime-editing',
    domainSlug: 'synthetic-biology',
    recordKind: 'concept',
    slug: 'prime-editing',
    title: 'Prime editing',
    description: 'A genome-editing method coupling a Cas9 nickase–reverse-transcriptase fusion with a prime-editing guide RNA that identifies a target and encodes a desired edit.',
    summary: 'The founding study demonstrated multiple edit classes in specified cellular systems. This record preserves the distinction between those experiments and claims about delivery, organism-level safety, durable clinical benefit, or broad therapeutic readiness.',
    claims: [{
      id: 'urn:maha:claim:prime-editing-demonstration',
      statement: 'The 2019 founding study demonstrated targeted substitutions, insertions, and deletions using prime editors in four human cell lines and primary post-mitotic mouse cortical neurons, with efficiency varying by edit and system.',
      claimKind: 'empirical-claim',
      evidenceMaturity: 'single-study',
      sourceIds: ['source-anzalone-prime-editing-2019'],
      scope: 'The experiments, cell systems, loci, editor variants, assays, and comparisons reported in the founding Nature paper and its supplementary information.',
      boundary: 'The experiments do not establish safe delivery, whole-organism efficacy, long-term clinical outcomes, or suitability for any individual treatment.',
      uncertainty: {
        kind: 'quantitative',
        statement: 'The source reports experiment-specific means and variation; there is no single valid efficiency or error interval for prime editing across targets and biological systems.',
        interval: 'See experiment-level figures and supplementary tables; not pooled into one value.',
      },
      replication: {
        independentReplicationCount: null,
        assessment: 'This Phase 1 record is deliberately bounded to the founding study and does not yet compile independent replication evidence.',
        asOfDate: EPISTEMIC_RELEASE_DATE,
      },
    }],
    sources: [{
      id: 'source-anzalone-prime-editing-2019',
      title: 'Search-and-replace genome editing without double-strand breaks or donor DNA',
      authors: ['Andrew V. Anzalone', 'Peyton B. Randolph', 'Jessie R. Davis', 'Alexander A. Sousa', 'Luke W. Koblan', 'et al.'],
      publisher: 'Nature',
      publishedAt: '2019-10-21',
      url: 'https://www.nature.com/articles/s41586-019-1711-4',
      identifiers: [
        { scheme: 'doi', value: '10.1038/s41586-019-1711-4' },
        { scheme: 'accession', value: 'PRJNA565979' },
      ],
      exactLocator: 'Abstract; Figures 1–5; Methods; Extended Data; Supplementary Tables 1–5.',
      rights: {
        basis: 'citation-with-paraphrase',
        quotationUsed: false,
        note: 'The Maha page paraphrases the reported method and scope, links to the version of record, and reproduces no paywalled passage.',
      },
      establishes: 'The paper introduces the prime-editing architecture and reports targeted edit classes across specified human cell lines and primary mouse neurons with experiment-dependent efficiencies and byproducts.',
      boundary: 'It is not clinical evidence, does not establish delivery to human tissues, and does not provide a universal safety or efficacy estimate for all prime-editor designs.',
      conflictsOfInterest: 'The publisher record states that authors filed patent applications and identifies company relationships involving genome-editing technologies.',
    }],
    sections: [
      {
        heading: 'What was demonstrated',
        paragraphs: [
          'Prime editing joins target recognition, a nickase, reverse transcription, and an extended guide RNA into a programmable editing workflow. The founding paper reports several classes of intended edits across named cell systems and loci.',
          'The unit of evidence is the particular editor, guide, target, cell system, protocol, assay, and comparison—not the phrase “prime editing” in isolation.',
        ],
        claimIds: ['urn:maha:claim:prime-editing-demonstration'],
      },
      {
        heading: 'What remains outside this record',
        paragraphs: [
          'Delivery, tissue specificity, immune response, unintended edits, genomic consequences, durability, manufacturing, dose, and clinical outcomes require separate records and cannot be inferred from cell-system demonstrations.',
          'The founding result establishes a method and an experimental capability. It does not authorize medical use or predict a treatment outcome.',
        ],
        claimIds: [],
      },
    ],
    bridges: [],
    boundaries: [
      'In-vitro or ex-vivo editing performance does not establish in-vivo delivery, safety, efficacy, or clinical benefit.',
      'Efficiency and byproduct measurements are target-, editor-, protocol-, assay-, and cell-system-specific.',
    ],
    prohibitedInferences: [
      'Do not use this record as medical advice or as evidence that a disease can currently be treated safely with prime editing.',
      'Do not generalize one experiment’s efficiency or off-target result to all prime editors, targets, tissues, or delivery systems.',
    ],
    publication: canonicalReview('Approved as a source-bounded empirical demonstration with explicit experimental and clinical non-transfer boundaries.'),
  },
  ...QUANTUM_SYSTEMS_GRAPH_RECORDS,
  ...SYNTHETIC_BIOLOGY_GRAPH_RECORDS,
  {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: 'urn:maha:record:fault-tolerant-industrial-advantage',
    domainSlug: 'quantum-systems',
    recordKind: 'hypothesis',
    slug: 'fault-tolerant-industrial-advantage',
    title: 'Fault-tolerant industrial advantage',
    description: 'A withheld candidate claim concerning useful system-scale advantage.',
    summary: 'Retained below the publication line until the task, baseline, hardware, logical error accounting, resource estimate, and independent review are specified.',
    claims: [],
    sources: [],
    sections: [],
    bridges: [],
    boundaries: ['No public claim has passed the Phase 1 gate.'],
    prohibitedInferences: ['Do not infer that the presence of this graph record constitutes evidence of industrial advantage.'],
    publication: {
      requestedPublicPromotion: false,
      reviewState: 'draft',
      canonicalVersion: '0.1.0',
      lastReviewedAt: `${EPISTEMIC_RELEASE_DATE}T00:00:00.000Z`,
      reviewEvents: [],
    },
  },
  {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    id: 'urn:maha:record:general-clinical-readiness-prime-editing',
    domainSlug: 'synthetic-biology',
    recordKind: 'hypothesis',
    slug: 'general-clinical-readiness-prime-editing',
    title: 'General clinical readiness of prime editing',
    description: 'A withheld candidate claim concerning broad clinical readiness.',
    summary: 'Retained below the publication line because clinical readiness must be assessed for a specific editor, delivery system, indication, dose, endpoint, population, and regulatory context.',
    claims: [],
    sources: [],
    sections: [],
    bridges: [],
    boundaries: ['No treatment-level proposition has passed the Phase 1 gate.'],
    prohibitedInferences: ['Do not infer clinical safety or efficacy from the existence of a method-level concept record.'],
    publication: {
      requestedPublicPromotion: false,
      reviewState: 'draft',
      canonicalVersion: '0.1.0',
      lastReviewedAt: `${EPISTEMIC_RELEASE_DATE}T00:00:00.000Z`,
      reviewEvents: [],
    },
  },
] as const

assertGraphIntegrity(EPISTEMIC_RECORDS)

export const PUBLIC_EPISTEMIC_RECORDS = EPISTEMIC_RECORDS.filter(
  (record) => evaluatePublicationGate(record).publicEligible,
)

export function getEpistemicDomain(slug: string) {
  return EPISTEMIC_DOMAINS.find((domain) => domain.slug === slug)
}

export function getDomainRecords(domainSlug: string) {
  return EPISTEMIC_RECORDS.filter((record) => record.domainSlug === domainSlug)
}

export function getPublicDomainRecords(domainSlug: string) {
  return PUBLIC_EPISTEMIC_RECORDS.filter((record) => record.domainSlug === domainSlug)
}

export function getEpistemicRecord(recordId: string) {
  return EPISTEMIC_RECORDS.find((record) => record.id === recordId)
}

export interface EpistemicRecordConnection {
  direction: 'inbound' | 'outbound'
  bridge: MathematicalBridge
  record: EpistemicRecord
}

export function getEpistemicRecordConnections(recordId: string): EpistemicRecordConnection[] {
  return EPISTEMIC_RECORDS.flatMap((record): EpistemicRecordConnection[] => record.bridges.flatMap((bridge): EpistemicRecordConnection[] => {
    if (bridge.sourceConceptId === recordId) {
      const target = getEpistemicRecord(bridge.targetConceptId)
      return target ? [{ direction: 'outbound' as const, bridge, record: target }] : []
    }
    if (bridge.targetConceptId === recordId) {
      const source = getEpistemicRecord(bridge.sourceConceptId)
      return source ? [{ direction: 'inbound' as const, bridge, record: source }] : []
    }
    return []
  }))
}

export function getPublicEpistemicRecord(domainSlug: string, kindSegment: string, slug: string) {
  return PUBLIC_EPISTEMIC_RECORDS.find(
    (record) => record.domainSlug === domainSlug
      && epistemicRecordPath(record) === `/knowledge/${domainSlug}/${kindSegment}/${slug}`,
  )
}

export function buildDomainRegistry(domainSlug: string) {
  const domain = getEpistemicDomain(domainSlug)
  if (!domain) return undefined
  const records = getDomainRecords(domainSlug)
  return {
    schemaVersion: EPISTEMIC_SCHEMA_VERSION,
    evidencePolicyVersion: EPISTEMIC_POLICY_VERSION,
    generatedAt: `${EPISTEMIC_RELEASE_DATE}T00:00:00.000Z`,
    domain,
    counts: {
      graphRecords: records.length,
      graphEdges: records.reduce((count, record) => count + record.bridges.length, 0),
      publicCanonicalRecords: records.filter((record) => evaluatePublicationGate(record).publicEligible).length,
      withheldRecords: records.filter((record) => !evaluatePublicationGate(record).publicEligible).length,
    },
    records: records.map((record) => {
      const decision = evaluatePublicationGate(record)
      return decision.publicEligible
        ? {
            id: record.id,
            title: record.title,
            recordKind: record.recordKind,
            reviewState: record.publication.reviewState,
            canonicalPath: epistemicRecordPath(record),
            contentHash: buildProvenanceBundle(record).contentHash,
            claims: record.claims,
            sources: record.sources,
            boundaries: record.boundaries,
            prohibitedInferences: record.prohibitedInferences,
          }
        : {
            id: record.id,
            title: record.title,
            recordKind: record.recordKind,
            reviewState: record.publication.reviewState,
            canonicalPath: null,
            withheld: true,
            gateReasons: decision.reasons,
          }
    }),
  }
}
