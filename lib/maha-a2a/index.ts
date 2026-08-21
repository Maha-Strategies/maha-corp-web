/**
 * @mahastrategies/maha-a2a
 *
 * An A2A agent card and handler for one bounded capability: evaluating a
 * context-control task and returning sanitized evidence.
 *
 * This is a protocol wrapper, not an orchestrator. It holds no queue, starts no
 * external task, schedules nothing, and initiates no payment. Maha's durable
 * task state and approvals live in the application; wrapping them again here
 * would create a second place where a workflow's truth is kept.
 */
import {
  GATEWAY_CONTRACT_VERSION,
  GATEWAY_POLICY_VERSION,
  gateContextRequest,
} from '../integrations/gateway-context-gate.ts'
import { verify } from '../context-control-cli/index.ts'

export const A2A_CAPABILITY_ID = 'maha.context-control.evaluate'
export const A2A_AGENT_VERSION = '0.1.0'

/**
 * The agent card.
 *
 * `payments`, `externalTaskCreation` and `documentRetention` are declared false
 * rather than omitted: a consumer deciding whether to trust this agent should
 * read the answer, not infer it from an absence.
 */
export function a2aAgentCard(baseUrl?: string): Record<string, unknown> {
  return {
    protocolVersion: '0.2',
    name: 'Maha Context Control',
    description: 'Evaluates a bounded context-control task and returns sanitized evidence metadata.',
    version: A2A_AGENT_VERSION,
    ...(baseUrl ? { url: baseUrl } : {}),
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true },
    skills: [{
      id: A2A_CAPABILITY_ID,
      name: 'Context-control evaluation',
      description: 'Compile a caller-supplied, sanitized context under an explicit policy and budget, and return evidence metadata.',
      tags: ['context', 'evidence', 'evaluation'],
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    }],
    contract: { version: GATEWAY_CONTRACT_VERSION, policyVersion: GATEWAY_POLICY_VERSION },
    boundaries: {
      payments: false,
      externalTaskCreation: false,
      documentRetention: false,
      credentialsAccepted: false,
      providerCalls: false,
      note: 'This agent evaluates and reports. It does not deploy, pay, schedule, or retain source documents.',
    },
  }
}

export type A2ATaskState = 'submitted' | 'completed' | 'failed' | 'rejected'

export type A2ATaskResult = {
  capability: typeof A2A_CAPABILITY_ID
  state: A2ATaskState
  /** True when this exact taskId was already answered; the result is replayed. */
  replayed: boolean
  /** Explicit, because a caller must know whether a human still has to act. */
  approvalRequired: false
  policy: { version: string; tokenBudget: number | null; minimumCompileTokens: number | null }
  evidence?: Record<string, unknown>
  failure?: { code: string; message: string }
  boundaries: { sourceDocumentsRetained: false; paymentsInitiated: false; externalTasksCreated: false }
}

const BOUNDARIES = { sourceDocumentsRetained: false, paymentsInitiated: false, externalTasksCreated: false } as const

/**
 * Replay memory is bounded and in-process on purpose.
 *
 * Durable task state belongs to the application's workflow ledger. A client
 * wrapper that persisted its own would become a second source of truth for
 * whether a task ran.
 */
const REPLAY_LIMIT = 256
const seen = new Map<string, A2ATaskResult>()

export function resetA2AReplayMemory(): void { seen.clear() }

/**
 * Handle one context-control task.
 *
 * The policy is the caller's and must be explicit: a task without a declared
 * token budget is rejected rather than given a default, because a budget the
 * caller did not choose is not a bounded evaluation.
 */
export function handleA2ATask(task: unknown): A2ATaskResult {
  const record = typeof task === 'object' && task !== null && !Array.isArray(task)
    ? task as Record<string, unknown>
    : null

  const reject = (code: string, message: string, policy?: A2ATaskResult['policy']): A2ATaskResult => ({
    capability: A2A_CAPABILITY_ID,
    state: 'rejected',
    replayed: false,
    approvalRequired: false,
    policy: policy ?? { version: GATEWAY_POLICY_VERSION, tokenBudget: null, minimumCompileTokens: null },
    failure: { code, message },
    boundaries: BOUNDARIES,
  })

  if (!record) return reject('invalid_task', 'The task must be a JSON object.')

  const taskId = typeof record.taskId === 'string' && record.taskId.length > 0 ? record.taskId : null
  if (!taskId) return reject('invalid_task', 'taskId is required.')

  const existing = seen.get(taskId)
  if (existing) return { ...existing, replayed: true }

  const policyInput = typeof record.policy === 'object' && record.policy !== null
    ? record.policy as Record<string, unknown>
    : null
  const tokenBudget = typeof policyInput?.tokenBudget === 'number' ? policyInput.tokenBudget : null
  const minimumCompileTokens = typeof policyInput?.minimumCompileTokens === 'number' ? policyInput.minimumCompileTokens : null
  const policy = { version: GATEWAY_POLICY_VERSION, tokenBudget, minimumCompileTokens }

  if (tokenBudget === null) {
    return reject('policy_required', 'policy.tokenBudget must be declared explicitly; this capability applies no default budget.', policy)
  }

  // Credentials are never a task field. Refusing loudly is better than
  // silently ignoring one a caller believed was required.
  for (const key of Object.keys(record)) {
    if (/secret|token(?!Budget)|credential|password|api[_-]?key|authorization/i.test(key)) {
      return reject('credential_rejected', 'This capability never accepts credentials in a task.', policy)
    }
  }

  const body = record.request
  const placeholder = 'a'.repeat(32)
  const gated = gateContextRequest({
    body,
    bodyBytes: Buffer.byteLength(JSON.stringify(body ?? null), 'utf8'),
    suppliedSecret: placeholder,
    configuredSecret: placeholder,
    contentType: 'application/json',
    alreadyCompiled: record.alreadyCompiled === true,
    limits: minimumCompileTokens === null ? undefined : { minimumCompileTokens },
  })

  let result: A2ATaskResult
  if (gated.outcome === 'rejected') {
    result = {
      capability: A2A_CAPABILITY_ID, state: 'failed', replayed: false, approvalRequired: false, policy,
      failure: { code: gated.code, message: gated.message }, boundaries: BOUNDARIES,
    }
  } else if (gated.outcome === 'passthrough') {
    result = {
      capability: A2A_CAPABILITY_ID, state: 'completed', replayed: false, approvalRequired: false, policy,
      evidence: { outcome: 'passthrough', reason: gated.reason, contractVersion: GATEWAY_CONTRACT_VERSION },
      boundaries: BOUNDARIES,
    }
  } else {
    // Envelope accepted. Compilation itself is the application's endpoint; this
    // wrapper reports admissibility and the policy it would be compiled under.
    result = {
      capability: A2A_CAPABILITY_ID, state: 'completed', replayed: false, approvalRequired: false, policy,
      evidence: {
        outcome: 'admissible',
        contractVersion: GATEWAY_CONTRACT_VERSION,
        limits: gated.limits,
        note: 'The envelope is admissible under the declared policy. Compilation is performed by the configured context-control endpoint, not by this agent.',
      },
      boundaries: BOUNDARIES,
    }
  }

  if (seen.size >= REPLAY_LIMIT) seen.delete(seen.keys().next().value as string)
  seen.set(taskId, result)
  return result
}

/** Structural verification of evidence, re-exported so an A2A client needs one dependency. */
export { verify as verifyContextEvidence }
