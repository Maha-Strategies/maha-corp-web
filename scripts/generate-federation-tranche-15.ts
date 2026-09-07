/**
 * Tranche 15 — configuration only.
 *
 * The review policy lives in lib/federation/tranche-runner.ts. This file supplies
 * what is genuinely this tranche's: which tranche it follows, the sources newly
 * inspected for it, and what was sought and could not be read.
 */
import { runTranche, type Inspection } from '../lib/federation/tranche-runner.ts'

const FRESH: Inspection[] = [
  {
    inspectionId: 'tr15-src-101',
    topic: 'calibration',
    sourceIdentity: 'JCGM 200:2012, International Vocabulary of Metrology (VIM), 3rd edition',
    version: 'JCGM 200:2012, 2008 version with minor corrections',
    stableUrl: 'https://www.bipm.org/documents/20126/2071204/JCGM_200_2012.pdf',
    locator: '§2.39 (6.11), definition of calibration.',
    inspectionDepth: 'targeted-definition-read',
    accessBasis: 'Published by the BIPM Joint Committee for Guides in Metrology, freely available.',
    reuseBasis: 'Reference-only. Bounded original summary; the definition is not reproduced verbatim into artifacts.',
    supportedClaimScope:
      'That calibration is a two-step operation: first establishing a relation between quantity values with measurement uncertainties provided by standards and the corresponding indications with their uncertainties, then using that relation to obtain a measurement result from an indication.',
    boundary:
      'This is measurement calibration of an instrument against a standard. It does not define calibration of a probabilistic forecast, which is a different concept sharing the word. A page on forecast calibration must not cite this definition, and this source establishes nothing about model confidence.',
    sourceClass: 'international-metrology-authority',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
  {
    inspectionId: 'tr15-src-102',
    topic: 'error-budgets',
    sourceIdentity: 'Site Reliability Engineering (Google), chapter "Embracing Risk"',
    version: 'As published at sre.google/sre-book, read 2026-09-06',
    stableUrl: 'https://sre.google/sre-book/embracing-risk/',
    locator: 'Section "Forming Your Error Budget".',
    inspectionDepth: 'targeted-section-read',
    accessBasis: 'Published online by the authors, freely readable.',
    reuseBasis: 'Reference-only. Bounded original summary; the text is not copied into artifacts.',
    supportedClaimScope:
      'That an error budget is derived from a service level objective and states, as an objective metric, how unreliable a service is permitted to be within a defined period.',
    boundary:
      'Describes one organisation\u2019s published practice, not a standard. It sets no budget for any service, and an error budget bounds permitted unreliability rather than measuring correctness.',
    sourceClass: 'industry-practice-reference',
    independence: 'independent-of-maha',
    relationshipToEarlier: 'No earlier version inspected in this programme.',
  },
]


runTranche({
  n: '15',
  prev: '14',
  frozenOn: '2026-09-06',
  priorCohorts: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11-mythology', '12-mythology', '13', '14'],
  freshInspections: FRESH,
  soughtButNotInspected: [
    {
      source: 'Digital Markets Act, Regulation (EU) 2022/1925',
      outcome: 'HTTP 202 with an empty body, as in Tranche 14',
      topic: 'competition-policy',
      resolution: 'None. An empty response is not a document, so the topic remains uninspected in this tranche too.',
    },
  ],
  situationNote:
    'The pool is 228 across four properties. agentic-publishing, maha-os and mayon-rajan were exhausted in ' +
    'Tranche 14 and contribute nothing here, so proportional coverage is bounded to what remains.',
})
