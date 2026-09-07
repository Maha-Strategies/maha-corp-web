/**
 * Source inspections for the health-data-consent definition prerequisite.
 *
 * The definition at /knowledge/private-machine-systems/health-data-consent/
 * definition sits in revise and is the single highest-fan-out unresolved
 * prerequisite on maha-os: 65 route candidates depend on it directly.
 *
 * These inspections exist so the definition can distinguish seven things that
 * ordinary usage runs together — consent, authorization, privacy notice,
 * lawful basis, revocation, emergency use, research consent — each against a
 * source that actually says so, at a locator a reader can follow.
 *
 * Two boundaries govern everything below.
 *
 * There is no universal law of health-data consent. Every instrument here is
 * jurisdictional: the CFR provisions bind HIPAA covered entities and their
 * business associates in the United States, and the GDPR articles bind
 * controllers and processors under EU law. A device operating in neither
 * regime is governed by neither, and a definition that reads these as a single
 * global rule would be manufacturing one.
 *
 * None of this yields a machine-executable consent rule. Every provision turns
 * on judgements a program cannot make: whether consent was "freely given",
 * whether a covered entity's professional judgement found disclosure in the
 * individual's best interests, whether a research waiver's IRB findings hold.
 * These sources let Maha say what it means and where the limits are. They do
 * not license a consent engine, and no page may cite them for one.
 */

export type ConsentDistinction =
  | 'consent' | 'authorization' | 'privacy-notice' | 'lawful-basis'
  | 'revocation' | 'emergency-use' | 'research-consent'

export type SourceInspection = {
  sourceId: string
  /** Exact title as the instrument names itself. */
  title: string
  instrument: string
  /** The version identity of what was inspected. */
  version: string
  /** Where the retrieved text was read. */
  retrievedFrom: string
  retrievedOn: string
  /** Whether that host is the version of record, or a rendering of it. */
  retrievalStanding: 'version-of-record' | 'secondary-rendering'
  jurisdiction: string
  rights: string
  /** Who and what the instrument binds. */
  scope: string
  /** What inspecting it does not license. */
  boundary: string
  distinctions: readonly ConsentDistinction[]
  /** Locator -> what that locator states. Quotations are short and attributed. */
  findings: readonly { locator: string; states: string }[]
}

const US_CFR_RIGHTS =
  'A work of the United States Government. Title 45 CFR is not subject to copyright in the United States and may ' +
  'be reproduced without permission.'
const GDPR_RIGHTS =
  'Official text of Regulation (EU) 2016/679. Reuse of EU legislative texts is permitted under Commission Decision ' +
  '2011/833/EU with acknowledgement of the source.'

export const HEALTH_DATA_CONSENT_SOURCES: readonly SourceInspection[] = [
  {
    sourceId: 'us-45cfr-164-508',
    title: 'Uses and disclosures for which an authorization is required',
    instrument: '45 CFR § 164.508 (HIPAA Privacy Rule)',
    version: 'Current CFR text as published by the Legal Information Institute',
    retrievedFrom: 'https://www.law.cornell.edu/cfr/text/45/164.508',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'United States',
    rights: US_CFR_RIGHTS,
    scope:
      'Binds HIPAA covered entities — health plans, health care clearinghouses, and health care providers who ' +
      'transmit health information electronically in covered transactions — and, through contract, their business ' +
      'associates. It does not bind a consumer device maker who is not a covered entity.',
    boundary:
      'Establishes when a written authorization is required and what it must contain. It does not define consent ' +
      'in general, does not apply outside the United States, and does not describe what a device should implement.',
    distinctions: ['authorization', 'revocation'],
    findings: [
      {
        locator: '§ 164.508(a)(1)',
        states:
          'A covered entity "may not use or disclose protected health information without an authorization that is ' +
          'valid under this section", except as otherwise permitted or required by the subchapter. Authorization is ' +
          'therefore an exception-bounded requirement, not a universal precondition.',
      },
      {
        locator: '§ 164.508(b)(5)',
        states:
          'An individual may revoke an authorization at any time, provided the revocation is in writing, except to ' +
          'the extent the covered entity has already acted in reliance on it, or where the authorization was ' +
          'obtained as a condition of obtaining insurance coverage. Revocation is prospective and has stated ' +
          'exceptions; it is not an unwind.',
      },
      {
        locator: '§ 164.508(c)(1)',
        states:
          'A valid authorization requires core elements: a description of the information, the person authorized to ' +
          'disclose, the recipient, each purpose, an expiration date or event, and the individual\'s signature and ' +
          'date. An authorization is a document with required contents, not a state flag.',
      },
    ],
  },
  {
    sourceId: 'us-45cfr-164-510',
    title: 'Uses and disclosures requiring an opportunity for the individual to agree or to object',
    instrument: '45 CFR § 164.510 (HIPAA Privacy Rule)',
    version: 'Current CFR text as published by the Legal Information Institute',
    retrievedFrom: 'https://www.law.cornell.edu/cfr/text/45/164.510',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'United States',
    rights: US_CFR_RIGHTS,
    scope: 'Binds HIPAA covered entities in the specific circumstances the section enumerates.',
    boundary:
      'Describes a narrow permission exercised under professional judgement. It is not a general emergency override, ' +
      'and it authorises no automated decision.',
    distinctions: ['emergency-use'],
    findings: [
      {
        locator: '§ 164.510(b)(3)',
        states:
          'Where the individual is not present or the opportunity to agree or object cannot practicably be provided ' +
          'because of incapacity or an emergency, the covered entity may, "in the exercise of professional ' +
          'judgment", determine whether disclosure is in the individual\'s best interests, and may disclose only ' +
          'information directly relevant to that person\'s involvement in the individual\'s care. The governing ' +
          'standard is a human professional judgement, which is precisely what a device cannot supply.',
      },
    ],
  },
  {
    sourceId: 'us-45cfr-164-520',
    title: 'Notice of privacy practices for protected health information',
    instrument: '45 CFR § 164.520 (HIPAA Privacy Rule)',
    version: 'Current CFR text as published by the Legal Information Institute',
    retrievedFrom: 'https://www.law.cornell.edu/cfr/text/45/164.520',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'United States',
    rights: US_CFR_RIGHTS,
    scope: 'Binds HIPAA covered entities as to the notice they must provide.',
    boundary: 'Notice is an information duty. Inspecting it establishes nothing about permission.',
    distinctions: ['privacy-notice'],
    findings: [
      {
        locator: '§ 164.520(a)(1)',
        states:
          'An individual has "a right to adequate notice of the uses and disclosures of protected health ' +
          'information that may be made by the covered entity".',
      },
      {
        locator: '§ 164.520(b)(1)(ii)(E)',
        states:
          'The notice must describe the types of uses and disclosures that require an authorization, and state that ' +
          'other uses and disclosures will be made only with the individual\'s written authorization. Notice and ' +
          'authorization are separate instruments: having given notice is not having obtained permission.',
      },
    ],
  },
  {
    sourceId: 'eu-gdpr-art-4',
    title: 'Definitions',
    instrument: 'Regulation (EU) 2016/679 (GDPR), Article 4',
    version: 'Regulation (EU) 2016/679, in force text',
    retrievedFrom: 'https://gdpr-info.eu/art-4-gdpr/',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'European Union',
    rights: GDPR_RIGHTS,
    scope: 'Definitions applying throughout the Regulation, binding controllers and processors under EU law.',
    boundary:
      'A definition of consent for GDPR purposes. It is not a definition of consent in general and carries no ' +
      'force outside the Regulation. The version of record is the EUR-Lex text; this was read in a rendering.',
    distinctions: ['consent'],
    findings: [
      {
        locator: 'Article 4(11)',
        states:
          'Consent is "any freely given, specific, informed and unambiguous indication of the data subject\'s ' +
          'wishes by which he or she, by a statement or by a clear affirmative action, signifies agreement". Four ' +
          'qualifiers, of which "freely given" is a judgement about circumstances, not a property of a record.',
      },
      {
        locator: 'Article 4(15)',
        states:
          '"Data concerning health" means personal data related to physical or mental health, including the ' +
          'provision of health care services, which reveal information about health status.',
      },
    ],
  },
  {
    sourceId: 'eu-gdpr-art-6',
    title: 'Lawfulness of processing',
    instrument: 'Regulation (EU) 2016/679 (GDPR), Article 6',
    version: 'Regulation (EU) 2016/679, in force text',
    retrievedFrom: 'https://gdpr-info.eu/art-6-gdpr/',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'European Union',
    rights: GDPR_RIGHTS,
    scope: 'Binds controllers determining a lawful basis for processing personal data under EU law.',
    boundary: 'Establishes that consent is one basis among six. It does not rank them or make consent the default.',
    distinctions: ['lawful-basis', 'consent'],
    findings: [
      {
        locator: 'Article 6(1)(a)-(f)',
        states:
          'Processing is lawful on any of six bases: consent (a), contract (b), legal obligation (c), vital ' +
          'interests (d), public task (e), or legitimate interests (f). Consent is one of six, so "we have consent" ' +
          'and "processing is lawful" are different claims, and a system that models only consent models a sixth ' +
          'of the question.',
      },
    ],
  },
  {
    sourceId: 'eu-gdpr-art-7',
    title: 'Conditions for consent',
    instrument: 'Regulation (EU) 2016/679 (GDPR), Article 7',
    version: 'Regulation (EU) 2016/679, in force text',
    retrievedFrom: 'https://gdpr-info.eu/art-7-gdpr/',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'European Union',
    rights: GDPR_RIGHTS,
    scope: 'Binds controllers relying on consent as their lawful basis.',
    boundary:
      'Sets conditions on consent and withdrawal. It does not specify a data structure, a receipt format, or an ' +
      'interface.',
    distinctions: ['consent', 'revocation'],
    findings: [
      {
        locator: 'Article 7(1)',
        states:
          'The controller "shall be able to demonstrate that the data subject has consented". Demonstrability is ' +
          'required; the form it takes is not prescribed.',
      },
      {
        locator: 'Article 7(3)',
        states:
          'The data subject may withdraw consent at any time; withdrawal does not affect the lawfulness of ' +
          'processing before it; the subject must be informed of this before consenting; and "it shall be as easy ' +
          'to withdraw as to give consent". Withdrawal under GDPR is prospective and unconditional, which differs ' +
          'from HIPAA revocation, where reliance and insurance-condition exceptions apply.',
      },
      {
        locator: 'Article 7(4)',
        states:
          'Whether consent is freely given must account for whether performance of a contract is conditional on ' +
          'consent to processing not necessary for it. Bundling consent into service access is a factor against ' +
          'validity.',
      },
    ],
  },
  {
    sourceId: 'eu-gdpr-art-9',
    title: 'Processing of special categories of personal data',
    instrument: 'Regulation (EU) 2016/679 (GDPR), Article 9',
    version: 'Regulation (EU) 2016/679, in force text',
    retrievedFrom: 'https://gdpr-info.eu/art-9-gdpr/',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'European Union',
    rights: GDPR_RIGHTS,
    scope: 'Binds controllers processing special categories, which expressly include data concerning health.',
    boundary:
      'Establishes a prohibition with enumerated exceptions. Meeting an Article 9 exception does not by itself ' +
      'make processing lawful: an Article 6 basis is still required.',
    distinctions: ['consent', 'emergency-use', 'research-consent'],
    findings: [
      {
        locator: 'Article 9(1)',
        states:
          'Processing of data concerning health "shall be prohibited" — the default for health data is prohibition, ' +
          'not permission subject to consent.',
      },
      {
        locator: 'Article 9(2)(a)',
        states:
          'Explicit consent to one or more specified purposes lifts the prohibition. Article 9 requires *explicit* ' +
          'consent, a higher bar than the Article 4(11) standard that suffices elsewhere.',
      },
      {
        locator: 'Article 9(2)(c)',
        states:
          'Processing necessary to protect vital interests where the data subject is "physically or legally ' +
          'incapable of giving consent" lifts the prohibition. The emergency route is defined by incapacity, not by ' +
          'urgency alone.',
      },
      {
        locator: 'Article 9(2)(j)',
        states:
          'Processing necessary for scientific or historical research or statistical purposes lifts the ' +
          'prohibition, subject to Article 89 conditions. Research is its own route, not a variety of consent.',
      },
    ],
  },
  {
    sourceId: 'us-45cfr-46-116',
    title: 'General requirements for informed consent',
    instrument: '45 CFR § 46.116 (Federal Policy for the Protection of Human Subjects)',
    version: 'Current CFR text as published by the Legal Information Institute',
    retrievedFrom: 'https://www.law.cornell.edu/cfr/text/45/46.116',
    retrievedOn: '2026-09-07',
    retrievalStanding: 'secondary-rendering',
    jurisdiction: 'United States',
    rights: US_CFR_RIGHTS,
    scope:
      'Binds research involving human subjects conducted or supported by a Common Rule department or agency. It ' +
      'does not govern ordinary product operation.',
    boundary:
      'Research consent is a distinct regime with its own elements and its own waiver route. It is not a stricter ' +
      'version of product consent and must not be cited for one.',
    distinctions: ['research-consent'],
    findings: [
      {
        locator: '§ 46.116(a)',
        states:
          'General requirements for informed consent apply "whether written or oral" — the regime is about what ' +
          'must be conveyed and understood, not about capturing a signature.',
      },
      {
        locator: '§ 46.116(b)',
        states:
          'Basic elements include a statement that the study involves research, foreseeable risks, benefits, ' +
          'alternatives, confidentiality, compensation for injury above minimal risk, contacts, voluntariness with ' +
          'no penalty for withdrawal, and a statement about future research use of identifiable data or ' +
          'biospecimens.',
      },
      {
        locator: '§ 46.116(e)-(f)',
        states:
          'Consent may be waived or altered on specific IRB findings. A regime that permits documented waiver ' +
          'cannot be modelled as a mandatory consent gate.',
      },
    ],
  },
]

/** What the definition may assert once these are cited, and what it may not. */
export const DEFINITION_SCOPE = {
  mayEstablish: [
    'That consent, authorization, privacy notice, lawful basis, revocation, emergency use and research consent are ' +
      'seven distinct instruments, each with a source that says so at a locator.',
    'That under GDPR health data is prohibited by default and requires explicit consent or another Article 9 route, ' +
      'and separately an Article 6 basis.',
    'That revocation differs by regime: prospective and unconditional under GDPR Article 7(3), prospective with ' +
      'reliance and insurance exceptions under 45 CFR 164.508(b)(5).',
    'That emergency handling turns on incapacity and human professional judgement, in both regimes inspected.',
  ],
  mayNotEstablish: [
    'A universal or global law of health-data consent. Every source is jurisdictional and binds a defined class of ' +
      'actor; a device outside both regimes is governed by neither.',
    'A machine-executable consent rule. "Freely given", "professional judgment" and IRB waiver findings are human ' +
      'judgements, and no inspected provision specifies a data structure, receipt format or interface.',
    'That Maha OS, or any product, complies with either regime. These inspections describe instruments, not this ' +
      'organisation\'s conformance to them.',
    'Legal advice, or that the definition substitutes for counsel in any jurisdiction.',
  ],
} as const
