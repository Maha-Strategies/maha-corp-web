import { randomBytes } from 'node:crypto'
import type { ApprovalRecord, ApprovalStore } from './approvals.ts'
import type { RecoveryRecord, RecoveryStore } from './recovery.ts'
import type { WorkflowTaskEvent, WorkflowTaskState, WorkflowTaskStore, WorkflowTransitionEvent } from './task-state.ts'

const TASK_ID = /^workflow-task-[a-f0-9]{32}$/
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/
const SHA256 = /^sha256:[a-f0-9]{64}$/

export const OPERATOR_TRANSITION_EVENTS = ['input_received', 'task_completed', 'task_failed', 'task_cancelled'] as const
export type OperatorTransitionEvent = typeof OPERATOR_TRANSITION_EVENTS[number]

export type OrchestrationSnapshot = {
  state: WorkflowTaskState
  events: WorkflowTaskEvent[]
  approvals: ApprovalRecord[]
  recoveryActions: RecoveryRecord[]
  contentRetained: false
}

export class WorkflowOrchestrator {
  private readonly tasks: WorkflowTaskStore
  private readonly approvals: ApprovalStore
  private readonly recovery: RecoveryStore

  constructor(tasks: WorkflowTaskStore, approvals: ApprovalStore, recovery: RecoveryStore) {
    this.tasks = tasks; this.approvals = approvals; this.recovery = recovery
  }

  async list(tenantId: string, limit = 50): Promise<WorkflowTaskState[]> { return this.tasks.list(tenantId, limit) }

  async create(input: { tenantId: string; taskId?: string; transitionId: string; evidenceSha256: string }) {
    const taskId = input.taskId ?? `workflow-task-${randomBytes(16).toString('hex')}`
    assertTaskInput({ ...input, taskId })
    const result = await this.tasks.transition({
      tenantId: input.tenantId, taskId, transitionId: input.transitionId, event: 'task_created',
      actor: { transport: 'orchestrator', targetId: 'maha.operator-console', operation: 'workflow.create' },
      evidenceSha256: input.evidenceSha256,
    })
    return { taskId, ...result }
  }

  async transition(input: { tenantId: string; taskId: string; transitionId: string; event: OperatorTransitionEvent; evidenceSha256: string }) {
    assertTaskInput(input)
    if (!OPERATOR_TRANSITION_EVENTS.includes(input.event)) throw new Error('event is not operator-controlled.')
    return this.tasks.transition({
      ...input,
      event: input.event as WorkflowTransitionEvent,
      actor: { transport: 'orchestrator', targetId: 'maha.operator-console', operation: `workflow.${input.event}` },
    })
  }

  async snapshot(tenantId: string, taskId: string): Promise<OrchestrationSnapshot | null> {
    if (!IDENTIFIER.test(tenantId) || !TASK_ID.test(taskId)) throw new Error('Invalid workflow target.')
    const state = await this.tasks.get(tenantId, taskId)
    if (!state) return null
    const [events, approvals, recoveryActions] = await Promise.all([
      this.tasks.events(tenantId, taskId), this.approvals.list(tenantId, taskId), this.recovery.list(tenantId, taskId),
    ])
    return { state, events, approvals, recoveryActions, contentRetained: false }
  }
}

function assertTaskInput(input: { tenantId: string; taskId: string; transitionId: string; evidenceSha256: string }): void {
  if (!IDENTIFIER.test(input.tenantId)) throw new Error('tenantId is invalid.')
  if (!TASK_ID.test(input.taskId)) throw new Error('taskId is invalid.')
  if (!IDENTIFIER.test(input.transitionId)) throw new Error('transitionId is invalid.')
  if (!SHA256.test(input.evidenceSha256)) throw new Error('evidenceSha256 is invalid.')
}
