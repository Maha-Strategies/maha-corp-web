/**
 * Tranche 14 — configuration only.
 *
 * The review policy lives in lib/federation/tranche-runner.ts. Extracted after
 * Tranche 15 was derived from this file by rename and inherited three faults
 * from it; the policy is now shared and each tranche supplies only its own
 * inputs. Output is byte-identical to what this generator produced before.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = [
  {
    inspectionId: 'tr14-src-101',
    topic: 'auditability',
    sourceIdentity: 'NIST SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    version: 'Revision 5, DOI 10.6028/NIST.SP.800-53r5',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf',
    locator: 'Control AU-2 (Event Logging), items a and b.',
    inspectionDepth: 'targeted-control-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That auditability begins with identifying which event types a system is capable of logging in support of the audit function, and coordinating that logging with the parties who need audit-related information.',
    boundary:
      'A control catalogue. It does not state that any system is auditable, does not select events for any deployment, and confers no assurance by being cited.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr14-src-102',
    topic: 'audit-export',
    sourceIdentity: 'NIST SP 800-53 Rev. 5, Security and Privacy Controls for Information Systems and Organizations',
    version: 'Revision 5, DOI 10.6028/NIST.SP.800-53r5',
    stableUrl: 'https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf',
    locator: 'Control AU-3 (Content of Audit Records), items a-f and the Discussion paragraph.',
    inspectionDepth: 'targeted-control-read',
    accessBasis: 'United States government publication, freely available.',
    reuseBasis: 'US government work; bounded original summary with attribution.',
    supportedClaimScope:
      'That an audit record is expected to carry the event description, timestamp, source, outcome and the identity of entities associated with the event, and that audit trails can reveal personally identifiable information, which the organisation is expected to consider and mitigate.',
    boundary:
      'Specifies record content, not an export format, retention period or disclosure rule. The privacy caution is a consideration the standard raises, not a permission to export.',
    sourceClass: 'government-standards-body',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'Same publication as tr14-src-101, inspected for a different control.',
  },
]

runTranche({
  n: '14',
  prev: '13',
  frozenOn: '2026-09-06',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13'],
  freshInspections: FRESH,
  soughtButNotInspected: [
    {
      source: 'Digital Markets Act, Regulation (EU) 2022/1925',
      outcome: 'HTTP 202 with an empty body',
      topic: 'competition-policy',
      resolution: 'None. An empty response is not a document, so the topic remains uninspected.',
    },
  ],
  situationNote:
    'Tranche 13 left 38 candidates blocked on 17 distinct prerequisites. Four exist in the remaining pool and ' +
    'each unlocks one dependent; the thirteen with higher fan-out are absent from the frozen map.',
})
