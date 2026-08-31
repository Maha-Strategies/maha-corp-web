import type { PilotJudgement } from './pilot-source-alignment.ts'

/** Internal editorial source/subject inspections; not external review or release. */
export const PILOT_BATCH_13_VERSION = 'maha-pilot-source-alignment-batch-13/1.0' as const
export const PILOT_BATCH_13_INPUT_DATE = '2026-08-30' as const

export const PILOT_BATCH_13_SLUGS = [
  'cell-line-versus-primary-cell-evidence',
  'change-seq-off-target-nomination',
  'double-strand-break-repair-outcomes',
  'error-mitigation-versus-correction',
  'ex-vivo-genome-editing-workflow',
  'genome-editor-delivery-systems',
  'guide-seq-off-target-detection',
  'in-vitro-versus-in-vivo-evidence',
  'in-vivo-genome-editing-workflow',
  'off-target-nomination-versus-confirmation',
  'pooled-crispr-screening',
  'single-cell-perturbation-readout',
  'somatic-versus-germline-editing',
  'targeted-amplicon-sequencing',
] as const

const inspected = (
  domainSlug: PilotJudgement['domainSlug'],
  sourceContractId: string,
  inspectedContentLocation: string,
  reason: string,
  versionOfRecord = false,
): PilotJudgement => ({
  domainSlug,
  sourceContractId,
  verdict: 'supported',
  metadataVerified: true,
  sourceContentInspected: true,
  inspectedContentLocation,
  artifactVersion: versionOfRecord ? 'version-of-record' : 'repository-copy',
  versionRelationship: versionOfRecord
    ? 'declared-version-of-record-inspected'
    : 'repository-copy-of-the-declared-version-of-record',
  rightsBasis: 'citation-with-paraphrase',
  reason,
  remediation: versionOfRecord
    ? 'None. The bounded subject is supported at the inspected version-of-record location.'
    : 'None for source/subject alignment. Preserve the repository-copy label and bounded locator.',
})

export const PILOT_BATCH_13_JUDGEMENTS: Readonly<Record<(typeof PILOT_BATCH_13_SLUGS)[number], PilotJudgement>> = {
  'cell-line-versus-primary-cell-evidence': inspected('synthetic-biology', 'source-lazzarotto-change-seq-2020', 'PMC7652380 author manuscript, “Chromatin state influences genome editing activity” and “Human genetic variation impacts genome editing nuclease activity”', 'The source compares biochemical nomination with editing activity across cellular contexts and examines primary-cell genetic variation.'),
  'change-seq-off-target-nomination': inspected('synthetic-biology', 'source-lazzarotto-change-seq-2020', 'PMC7652380 author manuscript, Abstract and “High-throughput Cas9 genome-wide activity profiling”', 'The source introduces CHANGE-seq as an in-vitro genome-wide method for nominating nuclease activity sites.'),
  'double-strand-break-repair-outcomes': inspected('synthetic-biology', 'source-cong-multiplex-editing-2013', 'PMC3795411 author manuscript, “Applications of Cas9 for homologous recombination and multiplex genome engineering”', 'The section reports indel formation, homologous-recombination editing, and a programmed large deletion after Cas9 cleavage.'),
  'error-mitigation-versus-correction': inspected('quantum-systems', 'source-temme-error-mitigation-2017', 'ar5iv rendering of arXiv:1612.02058, Abstract and Introduction', 'The source distinguishes expectation-value error mitigation without additional qubits from quantum error correction and states the methods’ assumptions.'),
  'ex-vivo-genome-editing-workflow': inspected('synthetic-biology', 'source-frangoul-crispr-2021', 'NEJM DOI 10.1056/NEJMoa2031054, Summary; Patient Demographics and Outcomes; Discussion', 'The article describes collection and ex-vivo editing of autologous cells, conditioning, reinfusion, and bounded outcomes for two participants.', true),
  'genome-editor-delivery-systems': inspected('synthetic-biology', 'source-gillmore-in-vivo-2021', 'NEJM DOI 10.1056/NEJMoa2107454, Abstract; Methods—Preclinical Studies; Clinical Study Treatment', 'The methods identify lipid-nanoparticle delivery of Cas9 mRNA and guide RNA and separate preclinical from clinical settings.', true),
  'guide-seq-off-target-detection': inspected('synthetic-biology', 'source-tsai-guide-seq-2015', 'PMC4320685 author manuscript, Abstract and “Overview of the GUIDE-seq method”', 'The source describes oligodeoxynucleotide capture at nuclease-induced breaks and sequencing-based genome-wide off-target detection.'),
  'in-vitro-versus-in-vivo-evidence': inspected('synthetic-biology', 'source-gillmore-in-vivo-2021', 'NEJM DOI 10.1056/NEJMoa2107454, Methods—Preclinical Studies and Clinical Study Design and Eligibility', 'The article separates preclinical studies from the human in-vivo clinical study, supporting the evidence-context boundary.', true),
  'in-vivo-genome-editing-workflow': inspected('synthetic-biology', 'source-gillmore-in-vivo-2021', 'NEJM DOI 10.1056/NEJMoa2107454, Abstract; Clinical Study Treatment; Assessments', 'The source describes systemic administration, dose cohorts, and subsequent clinical and laboratory assessments.', true),
  'off-target-nomination-versus-confirmation': inspected('synthetic-biology', 'source-lazzarotto-change-seq-2020', 'PMC7652380 author manuscript, Abstract; activity profiling; chromatin-state sections', 'The source distinguishes biochemical nomination from cell-context editing activity and reports targeted validation.'),
  'pooled-crispr-screening': inspected('synthetic-biology', 'source-shalem-crispr-screen-2014', 'PMC4089965 author manuscript, Abstract and pooled GeCKO negative- and positive-selection sections', 'The source reports pooled genome-scale CRISPR-Cas9 knockout screening with negative and positive selection.'),
  'single-cell-perturbation-readout': inspected('synthetic-biology', 'source-dixit-perturb-seq-2016', 'PMC5181115 author manuscript, Summary and “Perturb-seq: pooled, combinatorial CRISPR screens with scRNA-seq readout”', 'The source combines pooled CRISPR perturbations with single-cell RNA sequencing and guide-identity readout.'),
  'somatic-versus-germline-editing': inspected('synthetic-biology', 'source-liang-embryo-editing-2015', 'Protein & Cell DOI 10.1007/s13238-015-0153-5, Abstract; HBB-editing Results; Discussion', 'The article studies non-viable tripronuclear zygotes and explicitly discusses the germline context and safety barriers.', true),
  'targeted-amplicon-sequencing': inspected('synthetic-biology', 'source-tsai-guide-seq-2015', 'PMC4320685 author manuscript, “Overview of the GUIDE-seq method” and Discussion', 'The source uses targeted amplicon sequencing to confirm and quantify candidate off-target sites.'),
}

{
  const declared = new Set(PILOT_BATCH_13_SLUGS)
  const judged = Object.keys(PILOT_BATCH_13_JUDGEMENTS)
  if (declared.size !== PILOT_BATCH_13_SLUGS.length) throw new Error('Batch 13 declares a duplicate record slug.')
  if (judged.length !== PILOT_BATCH_13_SLUGS.length) throw new Error('Batch 13 judgement count does not match membership.')
  for (const slug of declared) {
    const judgement = PILOT_BATCH_13_JUDGEMENTS[slug]
    if (!judgement?.sourceContentInspected || !judgement.inspectedContentLocation) throw new Error(`${slug} lacks inspected content.`)
    if (judgement.verdict !== 'supported') throw new Error(`${slug} is not alignment-clear after inspection.`)
  }
}
