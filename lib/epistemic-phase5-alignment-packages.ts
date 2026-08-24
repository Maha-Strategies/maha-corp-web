export const EPISTEMIC_PHASE5_ALIGNMENT_PACKAGE_VERSION = 'maha-phase5-alignment-packages/1.0' as const

export interface Phase5AlignmentPackage {
  recordId: string
  blockerCode: string
  sourceUrl: string
  exactLocator: string
  proposedValue: string
  note: string
  rightsBasis: string
}

const LINK_ONLY = 'Official or peer-reviewed link and original paraphrase only; no source quotation imported.'

const appliedThermalUrl = 'https://www.appliedmaterials.com/us/en/semiconductor/products/processes/rapid-thermal-processing-treatments.html'
const calibrationUrl = 'https://projecteuclid.org/journals/electronic-journal-of-statistics/volume-17/issue-2/Regression-diagnostics-meets-forecast-evaluation-conditional-calibration-reliability-diagrams/10.1214/23-EJS2180.full'

/**
 * Evidence packages for the two Phase 4 targets whose mechanical source fields
 * were completed but whose source-to-claim mismatches remained explicit.
 * Compilation creates new noncanonical revisions and grants no review verdict.
 */
export const EPISTEMIC_PHASE5_ALIGNMENT_PACKAGES: readonly Phase5AlignmentPackage[] = [
  {
    recordId: 'urn:maha:record:legacy-semiconductor-ion-implantation-and-annealing',
    blockerCode: 'source-claim-alignment-mismatch:legacy-semiconductor-applied-implant',
    sourceUrl: appliedThermalUrl,
    exactLocator: '“Thermal Processing & Treatments”, paragraphs describing soak, spike, and millisecond anneals, temperature/time exposure, and thermal-budget reduction.',
    proposedValue: JSON.stringify({
      mode: 'split',
      retained: {
        establishes: 'The Ion Implant product page describes implantation as a semiconductor doping process and identifies equipment classes for different current, energy, and dose requirements.',
        boundary: 'This interested-party product description is limited to Applied Materials implantation categories; dose accuracy, process capability, qualification, and cross-vendor performance require separate evidence.',
      },
      addition: {
        id: 'legacy-semiconductor-applied-thermal-processing',
        title: 'Rapid Thermal Processing and Treatments',
        authors: ['Applied Materials'],
        publisher: 'Applied Materials',
        publishedAt: '',
        sourceChronology: { status: 'living-document', accessedAt: '2026-08-24' },
        url: appliedThermalUrl,
        identifiers: [{ scheme: 'url', value: appliedThermalUrl }],
        exactLocator: '“Thermal Processing & Treatments”, paragraphs describing soak, spike, and millisecond anneals, temperature/time exposure, and thermal-budget reduction.',
        rights: {
          basis: 'citation-with-paraphrase',
          quotationUsed: false,
          note: 'Maha stores an original paraphrase and exact locator to the official product-process page; no vendor passage is reproduced.',
        },
        establishes: 'The official process page identifies distinct anneal regimes and states that technology choice depends on allowable temperature and time exposure at a given manufacturing stage, including thermal-budget constraints.',
        boundary: 'This interested-party overview supplies process relationships rather than device-specific activation targets, junction profiles, qualified recipes, or comparative production performance.',
        conflictsOfInterest: 'Applied Materials markets the anneal systems described by the page.',
      },
      claimIds: ['urn:maha:claim:legacy-semiconductor-ion-implantation-and-annealing-02'],
    }),
    note: 'Split the overextended implant citation so the equipment-class claim retains the implant page while the activation and thermal-budget claim receives a bounded thermal-processing source.',
    rightsBasis: LINK_ONLY,
  },
  {
    recordId: 'urn:maha:record:legacy-mathematics-calibration-and-reliability',
    blockerCode: 'source-claim-alignment-mismatch:legacy-mathematics-nist-statistical-handbook',
    sourceUrl: calibrationUrl,
    exactLocator: 'Abstract; §§2–6 on calibration concepts, conditional T-calibration, reliability diagrams, score decomposition, and empirical estimation.',
    proposedValue: JSON.stringify({
      mode: 'replace',
      replacement: {
        id: 'legacy-mathematics-gneiting-resin-calibration',
        title: 'Regression diagnostics meets forecast evaluation: conditional calibration, reliability diagrams, and coefficient of determination',
        authors: ['Tilmann Gneiting', 'Johannes Resin'],
        publisher: 'Electronic Journal of Statistics, Institute of Mathematical Statistics',
        publishedAt: '2023-11-20',
        url: calibrationUrl,
        identifiers: [{ scheme: 'doi', value: '10.1214/23-EJS2180' }],
        exactLocator: 'Abstract; §§2–6 on calibration concepts, conditional T-calibration, reliability diagrams, score decomposition, and empirical estimation.',
        rights: {
          basis: 'citation-with-paraphrase',
          quotationUsed: false,
          note: 'Maha links to the peer-reviewed open journal record and stores original summary and boundary language without reproducing article text.',
        },
        establishes: 'The paper formalizes calibration and reliability, develops conditional calibration, introduces reliability diagrams, and separates miscalibration, discrimination, and uncertainty in forecast evaluation.',
        boundary: 'Finite-sample, dependent, nonstationary, and subgroup applications require a predeclared sampling, estimation, and uncertainty design; calibration alone is not comparative predictive skill or transportability.',
      },
      claimIds: ['urn:maha:claim:legacy-mathematics-calibration-and-reliability-01'],
    }),
    note: 'Replace the instrument-calibration handbook citation with a peer-reviewed source directly about probabilistic calibration, conditional reliability, diagrams, and discrimination.',
    rightsBasis: LINK_ONLY,
  },
] as const

export const EPISTEMIC_PHASE5_ALIGNMENT_BOUNDARY = 'These packages repair declared citation alignment and produce immutable noncanonical drafts. They are not expert review, canonical release, or evidence that any forecasting system has predictive skill.'
