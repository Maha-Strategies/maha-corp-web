/**
 * Tranche 16 — configuration only.
 *
 * The review policy lives in lib/federation/tranche-runner.ts.
 *
 * Dependency-first selection has nothing left to prioritise here. Of the twelve
 * prerequisites blocking Tranche 15, none exists in the remaining pool: the
 * count of available prerequisites has gone 4, then 1, then 0 across three
 * tranches. Selection cannot reach the remaining blocked pages, and further
 * tranches will not change that. What is missing is definitions the frozen map
 * never contained.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = [
  {
    inspectionId: 'tr16-src-101',
    topic: 'traceability',
    sourceIdentity: 'JCGM 200:2012, International Vocabulary of Metrology (VIM), 3rd edition',
    version: 'JCGM 200:2012',
    stableUrl: 'https://www.bipm.org/documents/20126/2071204/JCGM_200_2012.pdf',
    locator: '\u00a72.41 (6.10), definition of metrological traceability, with Note 1.',
    inspectionDepth: 'targeted-definition-read',
    accessBasis: 'Published by the BIPM Joint Committee for Guides in Metrology, freely available.',
    reuseBasis: 'Reference-only. Bounded original summary; the definition is not reproduced verbatim.',
    supportedClaimScope:
      'That metrological traceability is a property of a measurement result: the result can be related to a reference through a documented unbroken chain of calibrations, each contributing to the measurement uncertainty.',
    boundary:
      'This is traceability of a measurement to a reference standard. It is not provenance of a document, lineage of a citation, or an audit trail of a system, all of which share the word. A page about record traceability must not cite this definition.',
    sourceClass: 'international-metrology-authority',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same document as the calibration inspection in Tranche 15, read at a different definition.',
  },
  {
    inspectionId: 'tr16-src-102',
    topic: 'incident-reporting',
    sourceIdentity: 'NIST SP 800-61 Rev. 3, Incident Response Recommendations and Considerations for Cybersecurity Risk Management',
    version: 'Revision 3',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r3.pdf',
    locator: 'Executive Summary, paragraph placing incident response across the six CSF 2.0 Functions.',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That incident response is treated as part of cybersecurity risk management rather than a standalone activity, and is distributed across the Govern, Identify, Protect, Detect, Respond and Recover functions.',
    boundary:
      'Recommendations and considerations, not a reporting obligation. It sets no disclosure deadline, names no regulator, and does not establish when an incident must be reported to anyone.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr16-src-103',
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
  n: '16',
  prev: '15',
  frozenOn: '2026-09-06',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13', '14', '15'],
  freshInspections: FRESH,
  soughtButNotInspected: [
    {
      source: 'NIST SP 800-57 Part 1 Rev. 5',
      outcome: 'read, and found to be about key management rather than commitments',
      topic: 'cryptographic-commitments',
      resolution:
        'None. The document is accessible and was opened; it does not reach the topic. Citing it would stretch a ' +
        'key-management recommendation into a claim about commitment schemes.',
    },
  ],
  situationNote:
    'The pool is 128 across four properties. No prerequisite blocking Tranche 15 exists in it, so this cohort ' +
    'projects no unlocks and the remaining dependency gap is a property of the frozen map rather than of selection.',
})
