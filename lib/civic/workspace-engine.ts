import { civicDigest, immutableSnapshot } from './receipt.ts'
import { aiSafetySubmissionSchema, type AiSafetyRecord } from './ai-safety.ts'
import { citizenCaseActionSchema, consultationActionSchema, consultationSchema, operatorCaseActionSchema, safetyCaseSchema, type Consultation, type SafetyCase } from './workspace-types.ts'

export class WorkspaceError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
export function initialSafetyCase(record: AiSafetyRecord): SafetyCase {
  return safetyCaseSchema.parse({ version: 'civic-case-1', id: record.receipt.id, revision: 1,
    updatedAt: record.receipt.receivedAt, receipt: record.receipt, submission: record.submission, status: 'received',
    assignedReviewer: null, nextAction: null, dueOn: null, clarificationRequest: null, messages: [], publication: null,
    graph: { classification: 'unassessed', classificationRationale: 'Citizen-submitted concern; evidence has not been assessed.',
      nodes: [{ id: 'concern', kind: 'claim', text: record.submission.concern }, ...record.submission.sourceUrls.map((url, index) => ({
        id: `source-${index + 1}`, kind: 'source', text: 'Citizen-supplied source pointer', source: {
          citation: 'Citizen-supplied source pointer', url, publishedOn: null, checkedOn: null, contentDigest: null, verification: 'unreviewed-pointer',
        },
      }))], edges: record.submission.sourceUrls.map((_, index) => ({ from: `source-${index + 1}`, to: 'concern', relation: 'suggested-source', rationale: 'Submitted for review, without an automatic support determination.' })),
    },
  })
}
export function validateSafetyCase(input: unknown): SafetyCase {
  const state = safetyCaseSchema.parse(input)
  if (state.id !== state.receipt.id || (state.submission && state.submission.submissionId !== state.id)) throw new WorkspaceError('Invalid case identity.')
  if (state.publication && (state.publication.draft.id === state.id || civicDigest(state.publication.draft) !== state.publication.digest
    || (state.publication.consentedDigest && state.publication.consentedDigest !== state.publication.digest)
    || (state.publication.publishedAt && (!state.publication.privacyReviewed || state.publication.consentedDigest !== state.publication.digest)))) throw new WorkspaceError('Invalid publication gate.')
  if (state.status === 'withdrawn' && (state.submission || state.messages.length || state.graph.nodes.length || state.graph.edges.length || state.publication)) throw new WorkspaceError('Withdrawn cases cannot retain citizen content.')
  return immutableSnapshot(state)
}
export function citizenCaseView(input: SafetyCase) {
  const state = validateSafetyCase(input)
  return { ...state, messages: state.messages.filter(message => message.visibility === 'citizen') }
}
type CitizenMutation = Exclude<ReturnType<typeof citizenCaseActionSchema.parse>, { action: 'read' }>
type OperatorMutation = Exclude<ReturnType<typeof operatorCaseActionSchema.parse>, { action: 'read' | 'list' }>
export function changeSafetyCase(input: SafetyCase, action: CitizenMutation | OperatorMutation, actor: 'citizen' | 'operator', now = new Date()): SafetyCase {
  const state = structuredClone(validateSafetyCase(input))
  if (state.id !== action.id || state.revision !== action.expectedRevision) throw new WorkspaceError('The case changed. Reload before editing.', 409)
  if (state.status === 'withdrawn') throw new WorkspaceError('This case has been withdrawn.', 410)
  if (actor === 'citizen') citizenCaseActionSchema.parse(action); else operatorCaseActionSchema.parse(action)
  const at = now.toISOString()
  const add = (text: string, visibility: 'citizen' | 'operator', kind: SafetyCase['messages'][number]['kind']) => state.messages.push({ id: `${action.operationId}-${state.messages.length}`, at, author: actor, visibility, kind, text })
  switch (action.action) {
    case 'reply':
      if (!state.clarificationRequest) throw new WorkspaceError('No clarification request is open.')
      add(action.text, 'citizen', 'reply'); state.clarificationRequest = null; state.status = 'investigating'; break
    case 'correct':
      state.submission = aiSafetySubmissionSchema.parse({ ...state.submission, concern: action.concern, requestedAction: action.requestedAction })
      state.graph = initialSafetyCase({ receipt: state.receipt, submission: state.submission, status: 'received', review: null }).graph
      add('The citizen corrected the concern and requested action. Evidence assessment requires a fresh review.', 'citizen', 'correction')
      state.status = 'received'; state.clarificationRequest = null; state.publication = null; break
    case 'withdraw':
      state.submission = null; state.messages = []; state.publication = null; state.status = 'withdrawn'
      state.graph = { classification: 'unassessed', classificationRationale: 'Withdrawn by the citizen; content removed.', nodes: [], edges: [] }
      state.assignedReviewer = null; state.nextAction = null; state.dueOn = null; state.clarificationRequest = null; break
    case 'approve-publication':
      if (!state.publication || state.publication.digest !== action.draftDigest) throw new WorkspaceError('The publication draft changed. Read the current version before approving.', 409)
      state.publication.consentedDigest = action.draftDigest; break
    case 'revoke-publication': if (state.publication) { state.publication.consentedDigest = null; state.publication.publishedAt = null }; break
    case 'update':
      if ((action.status === 'awaiting-citizen') !== !!action.clarificationRequest) throw new WorkspaceError('Awaiting-citizen status requires a clarification request; other states must clear it.')
      state.assignedReviewer = action.assignedReviewer; state.nextAction = action.nextAction; state.dueOn = action.dueOn
      state.status = action.status; state.graph = action.graph; state.clarificationRequest = action.clarificationRequest
      if (action.privateNote) add(action.privateNote, 'operator', 'update')
      add(action.citizenUpdate, 'citizen', 'update')
      if (action.clarificationRequest) add(action.clarificationRequest, 'citizen', 'clarification')
      break
    case 'draft-publication':
      state.publication = { draft: action.draft, digest: civicDigest(action.draft), consentedDigest: null,
        privacyReviewed: action.privacyReviewed, privacyReviewer: action.privacyReviewer, publishedAt: null }; break
    case 'publish':
      if (!state.publication?.privacyReviewed || state.publication.consentedDigest !== state.publication.digest) throw new WorkspaceError('Exact-draft citizen consent and operator privacy review are required.', 409)
      state.publication.publishedAt = at; break
    case 'unpublish': if (state.publication) state.publication.publishedAt = null; break
  }
  state.revision++; state.updatedAt = at
  return validateSafetyCase(state)
}
export function changeConsultation(current: Consultation | null, input: ReturnType<typeof consultationActionSchema.parse>, now = new Date()): Consultation {
  const action = consultationActionSchema.parse(input)
  if (action.action === 'list') throw new WorkspaceError('Not a consultation edit.')
  if ((current?.revision ?? 0) !== action.expectedRevision || (current && current.id !== action.id)) throw new WorkspaceError('The consultation changed. Reload before editing.', 409)
  let state: Consultation
  if (action.action === 'save-draft') {
    if (current && current.status !== 'draft') throw new WorkspaceError('Published evidence packets are frozen. Create a new consultation for revised alternatives.', 409)
    state = { version: 'civic-consultation-1', id: action.id, revision: (current?.revision ?? 0) + 1, packet: action.packet,
      packetDigest: civicDigest(action.packet), status: 'draft', privacyReviewed: false, responseRationale: null, updatedAt: now.toISOString() }
  } else {
    if (!current) throw new WorkspaceError('Consultation not found.', 404)
    state = structuredClone(current); state.revision++; state.updatedAt = now.toISOString(); state.privacyReviewed = true
    if (action.action === 'open') {
      if (state.status !== 'draft' || Date.parse(state.packet.closesAt) <= now.getTime()) throw new WorkspaceError('Only a draft with a future closing date can open.')
      state.status = 'open'
    } else {
      if (state.status !== 'open') throw new WorkspaceError('Only an open consultation can close.')
      state.status = 'closed'; state.responseRationale = action.responseRationale
    }
  }
  return immutableSnapshot(consultationSchema.parse(state))
}
