/**
 * Tranche 17 — configuration only. The final tranche.
 *
 * 28 candidates remain, and no site::topic group exceeds the four-page cap, so
 * this cohort takes all of them and the frozen map is fully reviewed at 1,628.
 * The cohort is 28 rather than 100 because that is what is left, not because
 * selection stopped early.
 *
 * The review policy lives in lib/federation/tranche-runner.ts.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = [
  {
    inspectionId: 'tr17-src-101',
    topic: 'measurement-error',
    sourceIdentity: 'JCGM 200:2012, International Vocabulary of Metrology (VIM), 3rd edition',
    version: 'JCGM 200:2012',
    stableUrl: 'https://www.bipm.org/documents/20126/2071204/JCGM_200_2012.pdf',
    locator: '\u00a72.16 (3.10), definition of measurement error.',
    inspectionDepth: 'targeted-definition-read',
    accessBasis: 'Published by the BIPM Joint Committee for Guides in Metrology, freely available.',
    reuseBasis: 'Reference-only. Bounded original summary; the definition is not reproduced verbatim.',
    supportedClaimScope:
      'That measurement error is the measured quantity value minus a reference quantity value, and therefore presupposes a reference against which the measurement is compared.',
    boundary:
      'Error in the metrological sense, requiring a reference value. It is not model error, prediction error, or a mistake in a procedure, and it does not define uncertainty, which the same vocabulary treats as a separate concept.',
    sourceClass: 'international-metrology-authority',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Third definition read from the document already inspected for calibration in Tranche 15 and traceability in Tranche 16.',
  },
  {
    inspectionId: 'tr17-src-102',
    topic: 'provenance-graph',
    sourceIdentity: 'W3C PROV-DM: The PROV Data Model',
    version: 'W3C Recommendation, 30 April 2013',
    stableUrl: 'https://www.w3.org/TR/prov-dm/',
    locator: 'Bundle definition — a named set of provenance descriptions that is itself an entity.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'W3C Recommendation, publicly published.',
    reuseBasis: 'W3C Document Licence. Reference-only; specification text is not copied into artifacts.',
    supportedClaimScope:
      'That a set of provenance descriptions can be named and treated as an entity in its own right, so that the provenance of provenance can be expressed and a reader can ask who asserted a given account.',
    boundary:
      'A model for expressing provenance, not a guarantee of it. Naming a bundle does not make its contents accurate, and the specification does not establish that any recorded graph is complete.',
    sourceClass: 'open-standard-recommendation',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same Recommendation inspected in Tranche 13 for compiler provenance and citation lineage, read here at the bundle definition.',
  },
]

runTranche({
  n: '17',
  prev: '16',
  frozenOn: '2026-09-06',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13', '14', '15', '16'],
  freshInspections: FRESH,
  soughtButNotInspected: [],
  situationNote:
    'The final tranche. 28 candidates remained and all were selected, exhausting the frozen map at 1,628 reviewed ' +
    'candidates. No prerequisite blocking Tranche 16 exists in the pool, because there is no pool left.',
})
