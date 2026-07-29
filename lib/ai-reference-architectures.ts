export type ReferenceArchitecture = {
  slug: string
  title: string
  summary: string
  audience: string
  boundary: string
  flow: { label: string; detail: string; transfer?: string }[]
  assumptions: string[]
  measurements: { name: string; detail: string }[]
  failurePath: string[]
  sources: { name: string; url: string; note: string }[]
}

export const referenceArchitectures: ReferenceArchitecture[] = [
  {
    slug: 'offline-field-capture-authorized-cloud-escalation',
    title: 'Offline field capture with authorized cloud escalation',
    summary: 'A bounded field workflow where capture, validation, and a compact draft step remain on a supported device; only approved, necessary material is escalated when connectivity and policy allow.',
    audience: 'Field operations teams working with intermittent connectivity and reviewable records.',
    boundary: 'Local capture and first-pass processing do not imply that the whole workflow is private or offline. The design must specify device storage, telemetry, sync, identity, retention, and the precise conditions for remote escalation.',
    flow: [
      { label: '1 · Capture on supported device', detail: 'Worker records an approved note, form field, image, or audio input. The app states what it stores locally and for how long.' },
      { label: '2 · Local validation or draft', detail: 'A bounded local rule, model, or template checks required fields, creates a draft, or flags missing information. The worker reviews before submission.' },
      { label: '3 · Policy and consent gate', detail: 'The system evaluates whether the selected fields are authorized for a remote service and whether network conditions allow a request.', transfer: 'Only fields explicitly allowed by policy proceed.' },
      { label: '4 · Authorized cloud escalation', detail: 'An approved remote service performs the higher-capability step, such as retrieval or a larger-model draft. Output returns to the device or operational system for review.' },
      { label: '5 · Human approval & record', detail: 'A worker or supervisor accepts, corrects, or rejects the output. The organization records the review outcome and applies its retention policy.' },
    ],
    assumptions: ['The organization has identified which inputs are allowed to leave the device and which must not.', 'The least capable supported devices can run the local step within acceptable storage, power, heat, and response-time limits.', 'A human review point remains before any customer-facing, safety-relevant, or consequential action.', 'Remote-provider terms, identity, logging, retention, and incident procedures have been reviewed by the appropriate owners.'],
    measurements: [{ name: 'Task quality', detail: 'Compare the local draft and escalated output against a representative reviewed baseline; record correction and rejection rates.' }, { name: 'Continuity', detail: 'Measure task completion under poor or absent connectivity, including queue, retry, and manual fallback behavior.' }, { name: 'Data movement', detail: 'Verify which fields, metadata, logs, and diagnostic events leave the device during normal and error conditions.' }, { name: 'Device fit', detail: 'Test the least capable supported device for storage, memory, battery or power, temperature, accessibility, and response time.' }],
    failurePath: ['If the local step is unavailable, the worker uses the existing manual form or note workflow.', 'If network or authorization is unavailable, the system retains only policy-permitted local work and labels remote work as pending.', 'If remote output fails or times out, the user sees a clear error and can continue manually; no silent retry should broaden the data transfer.', 'If review detects an error, the approved record is corrected through the normal operational process and the case informs later evaluation.'],
    sources: [{ name: 'NIST Privacy Framework', url: 'https://www.nist.gov/privacy-framework/privacy-framework', note: 'Used as a risk-management reference: processing location is one element of a privacy outcome, not the whole outcome.' }, { name: 'NIST Cybersecurity Framework 2.0', url: 'https://www.nist.gov/cyberframework', note: 'Used as a general reference for managing cybersecurity risk and operational dependencies.' }, { name: 'Google LiteRT', url: 'https://developers.google.com/edge/litert', note: 'A current implementation reference for on-device model optimization and deployment targets.' }, { name: 'Apple Core ML', url: 'https://developer.apple.com/documentation/coreml', note: 'A platform implementation reference for integrating models into Apple-platform applications.' }],
  },
  {
    slug: 'school-accessibility-assistant',
    title: 'School accessibility assistant with teacher-controlled review',
    summary: 'A limited classroom support pattern for transforming teacher-approved material into an accessibility aid—such as a reading-level draft, caption draft, vocabulary support, or alternative format—without making the assistant an assessment authority.',
    audience: 'Schools and districts testing a narrowly scoped accessibility or instructional-support workflow.',
    boundary: 'This pattern is not a substitute for individualized education planning, accessibility review, student-data governance, or teacher judgment. It should begin with approved instructional material and an equivalent non-AI path for students who cannot or should not use it.',
    flow: [
      { label: '1 · Teacher-approved source', detail: 'A teacher selects material that is authorized for the activity. The pilot avoids uploading broader student records or unrelated classroom work.' },
      { label: '2 · Bounded transformation', detail: 'A local or approved remote tool creates a draft accessibility aid: for example, a plain-language explanation, caption draft, vocabulary list, or alternate-format candidate.' },
      { label: '3 · Teacher review', detail: 'The teacher checks accuracy, instructional fit, accessibility, and whether the draft changes meaning before it reaches students.' },
      { label: '4 · Student access', detail: 'Students receive the approved aid through the school’s established access path, with an equivalent non-AI route where appropriate.' },
      { label: '5 · Feedback & review', detail: 'The school records access friction, teacher correction, student usefulness, and unexpected data flows before expanding the pilot.' },
    ],
    assumptions: ['The school has determined permitted data, account, retention, and procurement conditions under its local rules and applicable law.', 'The workflow does not delegate grading, discipline, placement, or high-stakes educational decisions to the tool.', 'Teachers retain authority to approve or reject each output used in instruction.', 'The pilot has an accessibility and equitable-access plan for supported devices, assistive technologies, language needs, and alternatives.'],
    measurements: [{ name: 'Accessibility usefulness', detail: 'Use teacher and student feedback plus observed task completion; do not infer accessibility from feature availability alone.' }, { name: 'Instructional accuracy', detail: 'Sample outputs against source material and document corrections, omissions, and meaning-changing errors.' }, { name: 'Equity of access', detail: 'Test actual school and home access conditions, assistive technologies, account availability, and language needs.' }, { name: 'Data boundary', detail: 'Record prompts, uploads, identifiers, logs, accounts, retention, and any third-party processing used by the pilot.' }],
    failurePath: ['If the tool is unavailable or a draft is unsuitable, the teacher uses the original material and an established accommodation or instructional route.', 'If a student cannot access the tool, the school provides an equivalent non-AI path rather than making the tool a condition of participation.', 'If a data, content, or access concern arises, pause the affected workflow and route it through the school’s existing policy and review process.'],
    sources: [{ name: 'U.S. Department of Education: Protecting Student Privacy', url: 'https://studentprivacy.ed.gov/most-requested-documents', note: 'Points schools to guidance for evaluating how online educational services collect, use, and transmit student information.' }, { name: 'U.S. Department of Education: Student Privacy Guidance', url: 'https://studentprivacy.ed.gov/guidance', note: 'A current repository of student-data privacy guidance and resources.' }, { name: 'IES: Equal Access to Education Websites', url: 'https://ies.ed.gov/use-work/resource-library/report/forum-guide/forum-guide-ensuring-equal-access-education-websites-introduction-electronic-information', note: 'An education accessibility reference; a usable interface still requires context-specific testing.' }, { name: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', note: 'A voluntary framework for managing AI risks in design, development, use, and evaluation.' }],
  },
  {
    slug: 'internal-approved-document-search',
    title: 'Internal search over approved documents with source-linked answers',
    summary: 'A bounded internal search pattern that indexes an approved corpus, retrieves source passages, and asks a model to draft an answer with links back to those passages—while keeping access and corpus governance explicit.',
    audience: 'Small organizations and teams that need faster retrieval from a defined, permissioned internal knowledge base.',
    boundary: 'A source-linked answer is not necessarily correct, current, complete, or authorized for every user. The corpus, access controls, retention, retrieval quality, and human escalation path determine whether the tool is useful and appropriate.',
    flow: [
      { label: '1 · Corpus approval', detail: 'A designated owner admits specific documents, sets review dates, and excludes material that should not be indexed for this use.' },
      { label: '2 · Index and access boundary', detail: 'The system creates a searchable representation of the approved corpus and applies the organization’s intended identity and access rules.' },
      { label: '3 · User question', detail: 'An authenticated user asks a question within the supported scope. The system records only the operational information justified by policy.' },
      { label: '4 · Retrieval & draft answer', detail: 'The system retrieves candidate passages and drafts an answer that visibly links to the source material, limitations, or absence of evidence.' },
      { label: '5 · User verification or escalation', detail: 'The user opens the cited material for consequential decisions or escalates when sources conflict, are stale, or do not answer the question.' },
    ],
    assumptions: ['The organization can identify who owns corpus admission, document freshness, and access policy.', 'The system retrieves only material the signed-in user is allowed to see; test this with representative roles and boundary cases.', 'Answers visibly show sources and clearly distinguish retrieved material from any generated interpretation.', 'The tool does not replace a controlled policy, legal, financial, personnel, safety, or customer-commitment workflow.'],
    measurements: [{ name: 'Retrieval support', detail: 'On a representative question set, measure whether the cited passages actually support the answer and whether important sources are missed.' }, { name: 'Freshness', detail: 'Track corpus review dates, stale-document rate, and the proportion of answers that rely on out-of-date material.' }, { name: 'Access boundary', detail: 'Test allowed and prohibited roles, document exclusions, exports, logs, and administrative access before expanding the corpus.' }, { name: 'User outcome', detail: 'Measure time to find an answer, escalation rate, correction rate, and cases where users abandon the tool for the source system.' }],
    failurePath: ['If retrieval returns no reliable source, the system states that it could not find support and routes the user to the corpus owner or existing process.', 'If a cited source is stale, conflicting, or access-restricted, the user is directed to the responsible owner rather than receiving an unqualified answer.', 'If identity, indexing, or the model service fails, the organization falls back to the approved document repository and established help path.'],
    sources: [{ name: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', note: 'A voluntary framework for managing risks in AI design, use, and evaluation.' }, { name: 'NIST Privacy Framework', url: 'https://www.nist.gov/privacy-framework/privacy-framework', note: 'A risk-management reference for data processing and privacy outcomes.' }, { name: 'NIST Cybersecurity Framework 2.0', url: 'https://www.nist.gov/cyberframework', note: 'A general reference for governance of cybersecurity risks and dependencies.' }, { name: 'MPS: Claim-level provenance', url: 'https://www.mahastrategies.com/mps/claim-level-provenance', note: 'A local methodology reference for keeping sources, status, scope, and review history attached to substantive claims.' }],
  },
]

export function getReferenceArchitecture(slug: string) { return referenceArchitectures.find((architecture) => architecture.slug === slug) }
