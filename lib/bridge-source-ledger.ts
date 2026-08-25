/**
 * Append-only verification ledger for the Q-BR submitted bibliography.
 *
 * One entry per submitted citation. The submitted string is never edited here;
 * corrections, identifiers and locators are recorded alongside it so a reviewer
 * sees both what was claimed and what was found.
 *
 * A citation stays `unverifiable` when an authoritative index has been searched
 * and returned nothing. That is a finding, not a gap to be filled: three of the
 * twenty-four submitted citations do not appear to exist, and none of them was
 * replaced. Where a real document plausibly covers the same ground, it is
 * recorded as a `suggestedRevision` requiring an explicit human decision, never
 * as a silent correction.
 */

export const SOURCE_LEDGER_VERSION = 'maha-bridge-source-ledger/1.0' as const

export type LedgerVerification =
  | 'verified-correct'
  | 'verified-with-correction'
  | 'unverifiable'
  | 'not-independently-verified'

export interface SuggestedRevision {
  proposedCitation: string
  proposedIdentifier: string
  rationale: string
  decision: 'pending-human-decision'
}

export interface SourceLedgerEntry {
  /** `${bridgeId}${side}`, e.g. Q-BR-001A. */
  key: string
  bridgeId: string
  side: 'A' | 'B'
  verification: LedgerVerification
  /** DOI, arXiv id, ISBN, report number, or permanent publisher URL. */
  identifier: string | null
  /** Exact page, section, equation, theorem, figure, or table. Never invented. */
  locator: string | null
  /** Recorded beside the submitted metadata; the submitted string is untouched. */
  correction: string | null
  rightsBasis: string
  verificationSource: string
  verifiedAt: string | null
  suggestedRevision?: SuggestedRevision
}

const CROSSREF = 'Crossref REST API work record'
const ARXIV = 'arXiv abstract record'
const OPENLIB = 'Open Library catalogue record'
const PUBLISHER = 'Publisher landing page'
const METADATA_ONLY = 'bibliographic-metadata-only'

export const BRIDGE_SOURCE_LEDGER: readonly SourceLedgerEntry[] = [
  {
    key: 'Q-BR-001A',
    bridgeId: 'Q-BR-001',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.48550/arXiv.quant-ph/9705052',
    locator: null,
    correction:
      'Confirmed: Daniel Gottesman, "Stabilizer Codes and Quantum Error Correction", Caltech PhD thesis, submitted 28 May 1997, 114 pages. Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: ARXIV,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-001B',
    bridgeId: 'Q-BR-001',
    side: 'B',
    verification: 'not-independently-verified',
    identifier: null,
    locator: null,
    correction:
      'Open Library, Library of Congress and Google Books queries did not return an authoritative catalogue record in this sprint. Absence of a record from these three channels is not evidence the work does not exist; this is a verification gap, not a finding against the citation.',
    rightsBasis: METADATA_ONLY,
    verificationSource: 'Open Library, Library of Congress, Google Books (no usable record returned)',
    verifiedAt: null,
  },
  {
    key: 'Q-BR-002A',
    bridgeId: 'Q-BR-002',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1038/s41467-021-22030-5',
    locator: null,
    correction: 'Confirmed: Nature Communications 12 (2021), article 1779. Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-002B',
    bridgeId: 'Q-BR-002',
    side: 'B',
    verification: 'verified-correct',
    identifier: 'doi:10.1021/cr900056b',
    locator: null,
    correction:
      'Confirmed: Chemical Reviews 110(1), 111-131. Crossref records the issue date as 2009 online / 2010 print; the submitted year follows the print convention and is not an error.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-003A',
    bridgeId: 'Q-BR-003',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1016/j.aop.2010.09.012',
    locator: null,
    correction: 'Confirmed: Annals of Physics 326(1), 96-192 (2011). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-003B',
    bridgeId: 'Q-BR-003',
    side: 'B',
    verification: 'verified-correct',
    identifier: 'https://transformer-circuits.pub/2023/monosemantic-features',
    locator: null,
    correction:
      'Confirmed: Bricken, Templeton, Batson, Chen, Jermyn, Conerly, Turner, Anil, Denison, Askell, Lasenby, Wu, Kravec, Schiefer, Maxwell, Joseph, Tamkin, Nguyen, McLean, Burke, Hume, Carter, Henighan and Olah, Transformer Circuits Thread, October 2023. The venue issues no DOI; the permanent publisher URL is the stable identifier.',
    rightsBasis: METADATA_ONLY,
    verificationSource: PUBLISHER,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-004A',
    bridgeId: 'Q-BR-004',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1073/pnas.1619152114',
    locator: null,
    correction: 'Confirmed: PNAS 114(29), 7555-7560 (2017). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-004B',
    bridgeId: 'Q-BR-004',
    side: 'B',
    verification: 'unverifiable',
    identifier: null,
    locator: null,
    correction:
      'No such publication was found. A Crossref author-plus-container search for Siegbahn in Accounts of Chemical Research returns papers from 1971 to 2009 and nothing in 2018. Accounts of Chemical Research 51(9) (2018) exists as an issue, but no Siegbahn nitrogenase article at 2179-2186 is indexed. The submitted citation is preserved and was not replaced.',
    rightsBasis: 'not-applicable-unverifiable',
    verificationSource: 'Crossref author and container-title search',
    verifiedAt: '2026-08-25',
    suggestedRevision: {
      proposedCitation:
        'Siegbahn, P. E. M. (2019). The mechanism for nitrogenase including all steps. Physical Chemistry Chemical Physics.',
      proposedIdentifier: 'doi:10.1039/C9CP02073J',
      rationale:
        'A real Siegbahn nitrogenase mechanism paper covering comparable ground. Proposed only; adopting it changes the claim being supported and requires an explicit decision.',
      decision: 'pending-human-decision',
    },
  },
  {
    key: 'Q-BR-005A',
    bridgeId: 'Q-BR-005',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'isbn:9783662032251',
    locator: null,
    correction:
      'Work, author and publisher confirmed: Frank Pobell, "Matter and Methods at Low Temperatures", Springer. The catalogue record retrieved is the 1992 first edition; the submitted third edition (2007) was not separately confirmed in this sprint.',
    rightsBasis: METADATA_ONLY,
    verificationSource: OPENLIB,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-005B',
    bridgeId: 'Q-BR-005',
    side: 'B',
    verification: 'unverifiable',
    identifier: null,
    locator: null,
    correction:
      'No DOE Office of Science document titled "Isotope Program: Helium-3 Supply and Allocation Strategy" (2023) was found on energy.gov, science.osti.gov, osti.gov or gao.gov. The submitted citation carries no report number, DOI or permanent URL. It is preserved and was not replaced.',
    rightsBasis: 'not-applicable-unverifiable',
    verificationSource: 'energy.gov, science.osti.gov, osti.gov and gao.gov search',
    verifiedAt: '2026-08-25',
    suggestedRevision: {
      proposedCitation:
        'U.S. Government Accountability Office (2011). Managing Critical Isotopes: Weaknesses in DOE’s Management of Helium-3 Delayed the Federal Response to a Critical Supply Shortage. GAO-11-472.',
      proposedIdentifier: 'GAO-11-472',
      rationale:
        'A real, citable federal document on He-3 supply and allocation. It is an oversight report rather than a DOE strategy document, so it supports a different claim and requires an explicit decision.',
      decision: 'pending-human-decision',
    },
  },
  {
    key: 'Q-BR-006A',
    bridgeId: 'Q-BR-006',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'isbn:0071147829',
    locator: null,
    correction:
      'Work and author confirmed: Michael Tinkham, "Introduction to Superconductivity". The catalogue record retrieved is an earlier printing; the submitted second edition (1996, McGraw-Hill) was not separately confirmed in this sprint.',
    rightsBasis: METADATA_ONLY,
    verificationSource: OPENLIB,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-006B',
    bridgeId: 'Q-BR-006',
    side: 'B',
    verification: 'verified-with-correction',
    identifier: 'doi:10.1007/s10894-015-0050-1',
    locator: null,
    correction:
      'Submitted citation read "Fusion Engineering and Design, 107, 14-22". The paper is Journal of Fusion Energy 35(1), 41-53 (2016). Journal, volume and page range are all incorrect.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-007A',
    bridgeId: 'Q-BR-007',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1103/PhysRevLett.105.077001',
    locator: null,
    correction: 'Confirmed: Physical Review Letters 105(7), 077001 (2010). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-007B',
    bridgeId: 'Q-BR-007',
    side: 'B',
    verification: 'verified-correct',
    identifier: 'doi:10.1038/nature26160',
    locator: null,
    correction: 'Confirmed: Nature 556(7699), 43-50 (2018). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-008A',
    bridgeId: 'Q-BR-008',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1103/PhysRevA.86.032324',
    locator: null,
    correction: 'Confirmed: Physical Review A 86(3), 032324 (2012). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-008B',
    bridgeId: 'Q-BR-008',
    side: 'B',
    verification: 'verified-with-correction',
    identifier: 'doi:10.1016/j.cobeha.2016.06.003',
    locator: null,
    correction:
      'Submitted citation read "PNAS, 113(41), 11387-11395". The paper with that title is Wolfgang Maass, "Searching for principles of brain computation", Current Opinion in Behavioral Sciences 11, 81-92 (2016). Journal, volume and page range are all incorrect.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-009A',
    bridgeId: 'Q-BR-009',
    side: 'A',
    verification: 'verified-with-correction',
    identifier: 'doi:10.1038/nnano.2014.216',
    locator: null,
    correction:
      'Submitted title read "fault-tolerant fidelity"; the published title is "An addressable quantum dot qubit with fault-tolerant control-fidelity". Nature Nanotechnology 9(12), 981-985 (2014); volume, pages and year were accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: `${CROSSREF}; ${PUBLISHER}`,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-009B',
    bridgeId: 'Q-BR-009',
    side: 'B',
    verification: 'verified-correct',
    identifier: 'doi:10.1557/mrc.2014.32',
    locator: null,
    correction: 'Confirmed: MRS Communications 4(4), 143-157 (2014). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-010A',
    bridgeId: 'Q-BR-010',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.3389/fphy.2014.00005',
    locator: null,
    correction: 'Confirmed: Frontiers in Physics 2, article 5 (2014). Submitted metadata was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-010B',
    bridgeId: 'Q-BR-010',
    side: 'B',
    verification: 'unverifiable',
    identifier: null,
    locator: null,
    correction:
      'No book, chapter or page range matching "Blum, J. (2010). Numerical Simulation of Tokamak Plasmas. In Modeling and Control in Solid Mechanics" was found. The named container is a solid-mechanics volume, which is not a plausible home for a tokamak plasma chapter. Crossref indexes a related Blum article, "Numerical simulation of the plasma equilibrium in a Tokamak", Computer Physics Reports (1987). The submitted citation is preserved and was not replaced.',
    rightsBasis: 'not-applicable-unverifiable',
    verificationSource: 'Crossref bibliographic and Google Books search',
    verifiedAt: '2026-08-25',
    suggestedRevision: {
      proposedCitation:
        'Blum, J. (1987). Numerical simulation of the plasma equilibrium in a Tokamak. Computer Physics Reports.',
      proposedIdentifier: 'doi:10.1016/0167-7977(87)90015-3',
      rationale:
        'A real Blum paper on tokamak equilibrium computation. Different year and venue from the submitted citation, so adopting it is a substantive change requiring an explicit decision.',
      decision: 'pending-human-decision',
    },
  },
  {
    key: 'Q-BR-011A',
    bridgeId: 'Q-BR-011',
    side: 'A',
    verification: 'verified-correct',
    identifier: 'doi:10.1016/j.tcs.2014.05.025',
    locator: null,
    correction:
      'Confirmed. The 1984 proceedings paper has no DOI; the authoritative reprint is Theoretical Computer Science 560, 7-11 (2014), which is recorded as the stable identifier. Submitted metadata for the original was accurate.',
    rightsBasis: METADATA_ONLY,
    verificationSource: CROSSREF,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-011B',
    bridgeId: 'Q-BR-011',
    side: 'B',
    verification: 'unverifiable',
    identifier: null,
    locator: null,
    correction:
      'No matching publication, author or venue record exists in DBLP, which indexes IEEE S&P comprehensively, and a general literature search returned nothing. The submitted citation is preserved. Per the sprint constraint it was not replaced and no substitute is proposed.',
    rightsBasis: 'not-applicable-unverifiable',
    verificationSource: 'DBLP title, author and venue search; general literature search',
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-012A',
    bridgeId: 'Q-BR-012',
    side: 'A',
    verification: 'verified-with-correction',
    identifier: 'doi:10.1103/PhysRevApplied.13.034032',
    locator: null,
    correction:
      'Submitted citation read "Physical Review Letters, 124(8), 086801". The paper is Physical Review Applied 13(3), 034032 (2020); preprint arXiv:1810.03703. Journal, volume, issue and article number are all incorrect.',
    rightsBasis: METADATA_ONLY,
    verificationSource: `${CROSSREF}; arXiv; OSTI; NASA ADS`,
    verifiedAt: '2026-08-25',
  },
  {
    key: 'Q-BR-012B',
    bridgeId: 'Q-BR-012',
    side: 'B',
    verification: 'verified-correct',
    identifier: 'isbn:9783527405725',
    locator: null,
    correction:
      'Confirmed: Hasan Padamsee, "RF Superconductivity", Wiley-VCH. Catalogue records show 2008 and 2009 printings, consistent with the submitted year.',
    rightsBasis: METADATA_ONLY,
    verificationSource: OPENLIB,
    verifiedAt: '2026-08-25',
  },
]

if (BRIDGE_SOURCE_LEDGER.length !== 24) {
  throw new Error(`The ledger must cover all 24 submitted citations; found ${BRIDGE_SOURCE_LEDGER.length}.`)
}

const ledgerKeys = new Set(BRIDGE_SOURCE_LEDGER.map((entry) => entry.key))
if (ledgerKeys.size !== BRIDGE_SOURCE_LEDGER.length) {
  throw new Error('Duplicate key in the source ledger.')
}

export function ledgerEntry(bridgeId: string, side: 'A' | 'B'): SourceLedgerEntry {
  const entry = BRIDGE_SOURCE_LEDGER.find((item) => item.bridgeId === bridgeId && item.side === side)
  if (!entry) throw new Error(`No ledger entry for ${bridgeId}${side}.`)
  return entry
}
