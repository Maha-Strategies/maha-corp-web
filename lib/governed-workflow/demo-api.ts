import { GwsgEngine, MemoryGwsgEventLog, assessRecovery, verifyEventChain } from './engine.ts'
import { findUnboundedStrings, sanitizeEvidence, sanitizeTimeline, sanitizeTransition } from './audit.ts'
import { declaredInputDigest, evidenceSetDigest } from './evidence.ts'
import {
  GWSG_ACTION_REQUEST_SHA256, GWSG_ACTORS, GWSG_DECLARED_INPUT, GWSG_DEFAULT_CHAIN, GWSG_EVIDENCE,
  GWSG_OPERATIONS, GWSG_REQUIRED_EVIDENCE_KINDS, GWSG_UNCERTAINTIES, fixedClock,
} from './fixtures.ts'
import { resolveGwsgPolicy } from './policy.ts'
import { GWSG_SCENARIO_EXCEPTION_SECRET } from './scenarios.ts'
import type { ApprovalBinding, EvidenceReference, GwsgState, UncertaintyDeclaration } from './types.ts'

/**
 * The narrow demo surface.
 *
 * Deliberately stateless: a request carries an ordered program, the program
 * runs against an engine that exists only for that request, and nothing
 * survives it. A durable server-side store would be a place for real records
 * to accumulate, and this prototype has no business holding any.
 *
 * The evidence input accepts metadata only. There is no field for document
 * content, and `assertMetadataOnly` rejects a payload that tries to smuggle
 * one in rather than silently dropping it.
 */

export const GWSG_DEMO_OPERATIONS = [
  'create_workflow',
  'submit_evidence',
  'evaluate_policy',
  'request_approval',
  'record_approval',
  'authorize_action',
  'replay_recover',
  'audit_timeline',
] as const

export type GwsgDemoOperation = (typeof GWSG_DEMO_OPERATIONS)[number]

export class GwsgDemoError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const MAX_PROGRAM_STEPS = 24
const MAX_STRING_LENGTH = 200
/** Field names that would carry document content rather than metadata. */
const FORBIDDEN_EVIDENCE_FIELDS = ['content', 'text', 'body', 'raw', 'excerpt', 'snippet', 'document', 'passage']

function assertMetadataOnly(value: unknown, path = 'evidence'): void {
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
    throw new GwsgDemoError('payload_not_metadata', `${path} exceeds the metadata length bound; this API accepts references and digests, not document content.`)
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertMetadataOnly(entry, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_EVIDENCE_FIELDS.includes(key.toLowerCase())) {
        throw new GwsgDemoError('payload_not_metadata', `${path}.${key} is not accepted; this API stores references and digests, never source content.`)
      }
      assertMetadataOnly(entry, `${path}.${key}`)
    }
  }
}

/** Named synthetic evidence. A caller selects from the corpus; it cannot author bytes. */
const EVIDENCE_CATALOG: Record<string, EvidenceReference> = {
  claim_form: GWSG_EVIDENCE.claimForm,
  policy_document: GWSG_EVIDENCE.policyDocument,
  assessment_note: GWSG_EVIDENCE.assessorNote,
  claim_form_revised: GWSG_EVIDENCE.claimFormRevised,
}

const UNCERTAINTY_CATALOG: Record<string, UncertaintyDeclaration> = {
  missing_assessment: GWSG_UNCERTAINTIES.missingAssessment,
  minor_ambiguity: GWSG_UNCERTAINTIES.minorAmbiguity,
}

export type GwsgDemoStep = {
  operation: GwsgDemoOperation
  /** Keys into the synthetic evidence catalog. */
  evidence?: string[]
  uncertainties?: string[]
  intendedState?: GwsgState
  idempotencyKey?: string
  action?: boolean
  decision?: 'grant' | 'deny'
}

export type GwsgDemoRequest = { program: GwsgDemoStep[] }

export function parseDemoRequest(raw: unknown): GwsgDemoRequest {
  if (!raw || typeof raw !== 'object') throw new GwsgDemoError('invalid_request', 'A JSON object is required.')
  assertMetadataOnly(raw, 'request')
  const program = (raw as { program?: unknown }).program
  if (!Array.isArray(program) || program.length === 0) throw new GwsgDemoError('invalid_request', 'program must be a non-empty array.')
  if (program.length > MAX_PROGRAM_STEPS) throw new GwsgDemoError('invalid_request', `program accepts at most ${MAX_PROGRAM_STEPS} steps.`)
  const steps: GwsgDemoStep[] = program.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new GwsgDemoError('invalid_request', `program[${index}] must be an object.`)
    const step = entry as Record<string, unknown>
    const operation = step.operation
    if (typeof operation !== 'string' || !GWSG_DEMO_OPERATIONS.includes(operation as GwsgDemoOperation)) {
      throw new GwsgDemoError('invalid_request', `program[${index}].operation must be one of: ${GWSG_DEMO_OPERATIONS.join(', ')}.`)
    }
    const evidence = step.evidence
    if (evidence !== undefined) {
      if (!Array.isArray(evidence) || evidence.some((key) => typeof key !== 'string' || !(key in EVIDENCE_CATALOG))) {
        throw new GwsgDemoError('invalid_request', `program[${index}].evidence must reference the synthetic catalog: ${Object.keys(EVIDENCE_CATALOG).join(', ')}.`)
      }
    }
    const uncertainties = step.uncertainties
    if (uncertainties !== undefined) {
      if (!Array.isArray(uncertainties) || uncertainties.some((key) => typeof key !== 'string' || !(key in UNCERTAINTY_CATALOG))) {
        throw new GwsgDemoError('invalid_request', `program[${index}].uncertainties must reference the synthetic catalog: ${Object.keys(UNCERTAINTY_CATALOG).join(', ')}.`)
      }
    }
    return {
      operation: operation as GwsgDemoOperation,
      evidence: evidence as string[] | undefined,
      uncertainties: uncertainties as string[] | undefined,
      intendedState: step.intendedState as GwsgState | undefined,
      idempotencyKey: typeof step.idempotencyKey === 'string' ? step.idempotencyKey.slice(0, 120) : undefined,
      action: step.action === true,
      decision: step.decision === 'deny' ? 'deny' : step.decision === 'grant' ? 'grant' : undefined,
    }
  })
  return { program: steps }
}

export type GwsgDemoStepResult = {
  operation: GwsgDemoOperation
  outcome: 'ok' | 'rejected'
  detail: unknown
}

export type GwsgDemoResponse = {
  schemaVersion: string
  synthetic: true
  /** Restates the boundary in-band, so a stored response carries its own caveat. */
  notice: string
  steps: GwsgDemoStepResult[]
  finalState: GwsgState
  timeline: ReturnType<typeof sanitizeTimeline>
  chainIntegrity: ReturnType<typeof verifyEventChain>
  recovery: ReturnType<typeof assessRecovery>
}

export const GWSG_DEMO_NOTICE =
  'Synthetic evaluation corpus. No real claim, document, reviewer, or payment is involved, and no side effect leaves this process.'

/**
 * Runs one program.
 *
 * The clock is fixed and the engine is fresh, so the same program always
 * returns the same digests. That is what lets a reader verify a response
 * against a documented example rather than take it on trust.
 */
export function runDemoProgram(request: GwsgDemoRequest): GwsgDemoResponse {
  const engine = new GwsgEngine({
    log: new MemoryGwsgEventLog(),
    clock: fixedClock(),
    exceptionSecret: GWSG_SCENARIO_EXCEPTION_SECRET,
    requiredEvidenceKinds: GWSG_REQUIRED_EVIDENCE_KINDS,
  })
  const instanceId = 'gwsg-instance-demo'
  const resolved = resolveGwsgPolicy(GWSG_DEFAULT_CHAIN)
  let created = false
  let currentEvidence: EvidenceReference[] = []
  let lastApprovalId: string | null = null
  const steps: GwsgDemoStepResult[] = []

  const bindingFor = (evidence: EvidenceReference[]): ApprovalBinding => ({
    workflowInstanceId: instanceId,
    transitionId: `gwsg-action-${GWSG_OPERATIONS.issueDecisionLetter}`,
    policyVersion: resolved.policyVersion,
    policySha256: resolved.policySha256,
    inputSha256: declaredInputDigest({ ...GWSG_DECLARED_INPUT }),
    evidenceSetSha256: evidenceSetDigest(evidence),
  })

  const requireCreated = () => {
    if (!created) throw new GwsgDemoError('workflow_not_created', 'create_workflow must run before this operation.')
  }

  const transition = (step: GwsgDemoStep, fallbackState: GwsgState, key: string) =>
    engine.applyTransition({
      request: {
        workflowInstanceId: instanceId,
        intendedState: step.intendedState ?? fallbackState,
        actor: GWSG_ACTORS.intakeAgent,
        idempotencyKey: step.idempotencyKey ?? key,
        declaredInput: { ...GWSG_DECLARED_INPUT },
        evidence: currentEvidence,
        uncertainties: (step.uncertainties ?? []).map((name) => UNCERTAINTY_CATALOG[name]),
        action: step.action ? { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 } : undefined,
      },
      resolved,
    })

  for (const [index, step] of request.program.entries()) {
    switch (step.operation) {
      case 'create_workflow': {
        if (created) throw new GwsgDemoError('workflow_exists', 'create_workflow may run only once per program.')
        engine.createWorkflow({ workflowInstanceId: instanceId, workflowTemplateId: 'gwsg-template-claims-review', tenantId: 'tenant-synthetic-claims' })
        created = true
        steps.push({ operation: step.operation, outcome: 'ok', detail: { workflowInstanceId: instanceId, state: 'draft' } })
        break
      }
      case 'submit_evidence': {
        requireCreated()
        currentEvidence = (step.evidence ?? []).map((name) => EVIDENCE_CATALOG[name])
        const result = transition(step, 'evidence_collected', `demo-${index}`)
        steps.push({
          operation: step.operation,
          outcome: result.accepted ? 'ok' : 'rejected',
          detail: { transition: sanitizeTransition(result.transition), evidence: sanitizeEvidence(currentEvidence), evidenceSetSha256: evidenceSetDigest(currentEvidence) },
        })
        break
      }
      case 'evaluate_policy': {
        requireCreated()
        const result = transition(step, 'policy_evaluated', `demo-${index}`)
        steps.push({ operation: step.operation, outcome: result.accepted ? 'ok' : 'rejected', detail: { transition: sanitizeTransition(result.transition), policySha256: resolved.policySha256, scopeChain: resolved.scopeChain } })
        break
      }
      case 'request_approval': {
        requireCreated()
        const record = engine.requestApproval(bindingFor(currentEvidence))
        lastApprovalId = record.approvalId
        // Requesting an approval also moves the instance into
        // `approval_pending`. Keeping the approval record and the workflow
        // state in step is the point: an approval that exists while the
        // workflow claims to be somewhere else is exactly the drift this
        // model is supposed to make impossible.
        const moved = transition(step, 'approval_pending', `demo-${index}`)
        steps.push({ operation: step.operation, outcome: moved.accepted ? 'ok' : 'rejected', detail: { approval: record, transition: sanitizeTransition(moved.transition) } })
        break
      }
      case 'record_approval': {
        if (!lastApprovalId) throw new GwsgDemoError('approval_not_requested', 'request_approval must run before record_approval.')
        // Only a human reviewer may decide. The demo supplies the synthetic
        // reviewer identity itself so an API caller cannot present as one.
        const decision = step.decision ?? 'grant'
        const record = engine.recordApprovalDecision({ approvalId: lastApprovalId, decision, decidedBy: GWSG_ACTORS.humanReviewer })
        const moved = engine.applyTransition({
          request: {
            workflowInstanceId: instanceId,
            intendedState: record.state === 'granted' ? 'approved' : 'denied',
            actor: GWSG_ACTORS.humanReviewer,
            idempotencyKey: step.idempotencyKey ?? `demo-${index}`,
            declaredInput: { ...GWSG_DECLARED_INPUT },
            evidence: currentEvidence,
            uncertainties: [],
          },
          resolved,
        })
        steps.push({ operation: step.operation, outcome: moved.accepted ? 'ok' : 'rejected', detail: { approval: record, transition: sanitizeTransition(moved.transition) } })
        break
      }
      case 'authorize_action': {
        requireCreated()
        const result = engine.applyTransition({
          request: {
            workflowInstanceId: instanceId,
            intendedState: 'action_authorized',
            actor: GWSG_ACTORS.reviewAgent,
            idempotencyKey: step.idempotencyKey ?? `demo-${index}`,
            declaredInput: { ...GWSG_DECLARED_INPUT },
            evidence: currentEvidence,
            uncertainties: (step.uncertainties ?? []).map((name) => UNCERTAINTY_CATALOG[name]),
            action: { operation: GWSG_OPERATIONS.issueDecisionLetter, requestSha256: GWSG_ACTION_REQUEST_SHA256 },
          },
          resolved,
        })
        steps.push({ operation: step.operation, outcome: result.accepted ? 'ok' : 'rejected', detail: { transition: sanitizeTransition(result.transition), idempotent: result.idempotent, reasonCodes: result.reasonCodes } })
        break
      }
      case 'replay_recover': {
        requireCreated()
        const timeline = engine.timeline(instanceId)
        steps.push({ operation: step.operation, outcome: 'ok', detail: { replayedState: engine.instance(instanceId).currentState, chainIntegrity: verifyEventChain(timeline), recovery: assessRecovery(timeline) } })
        break
      }
      case 'audit_timeline': {
        requireCreated()
        steps.push({ operation: step.operation, outcome: 'ok', detail: { timeline: sanitizeTimeline(engine.timeline(instanceId)) } })
        break
      }
    }
  }

  if (!created) throw new GwsgDemoError('workflow_not_created', 'program must begin with create_workflow.')
  const timeline = engine.timeline(instanceId)
  const response: GwsgDemoResponse = {
    schemaVersion: '1.0.0',
    synthetic: true,
    notice: GWSG_DEMO_NOTICE,
    steps,
    finalState: engine.instance(instanceId).currentState,
    timeline: sanitizeTimeline(timeline),
    chainIntegrity: verifyEventChain(timeline),
    recovery: assessRecovery(timeline),
  }

  // Last line of defence. If any projection ever grows a field long enough to
  // hold prose, this fails loudly here rather than shipping it to a caller.
  const unbounded = findUnboundedStrings(response)
  if (unbounded.length > 0) {
    throw new GwsgDemoError('projection_not_metadata', `Response contains an unbounded string at ${unbounded[0].path}.`, 500)
  }
  return response
}
