// Writing one attributed spend row.
//
// Same contract as the usage meter it sits beside: this runs after the response
// exists, never throws, and never delays delivery. An attribution outage costs
// a line on a report, and a report is not worth a failed request.
//
// It records credits *charged*, not credits owed. A chargeback ledger whose
// numbers cannot be reconciled against the balance they claim to explain is
// worse than no ledger, because it will be believed.

import { createAgentInquiryLedger } from './agent-inquiry-ledger.ts'

export type SpendSurface = 'compress' | 'jobs' | 'gateway' | 'audit'

type Ledger = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }> } | null

const whole = (value: number | undefined) => Math.max(0, Math.round(value ?? 0))

export async function recordAgentTaskSpend(input: {
  tenantId: string
  taskId: string
  costCenter: string
  surface: SpendSurface
  creditsCharged?: number
  inputTokens?: number
  outputTokens?: number
  tokensSaved?: number
  ledger?: Ledger
}): Promise<void> {
  try {
    // Guarded here as well as in the function: a row with no tenant or task is
    // an unallocatable line on an invoice, and the cheapest place to not create
    // one is before the round trip.
    if (!input.tenantId.trim() || !input.taskId.trim()) return

    const ledger = input.ledger !== undefined ? input.ledger : createAgentInquiryLedger()
    if (!ledger) return

    const { error } = await ledger.rpc('record_agent_task_spend', {
      p_tenant_id: input.tenantId,
      p_task_id: input.taskId,
      p_cost_center: input.costCenter,
      p_surface: input.surface,
      p_credits_charged: whole(input.creditsCharged),
      p_input_tokens: whole(input.inputTokens),
      p_output_tokens: whole(input.outputTokens),
      p_tokens_saved: whole(input.tokensSaved),
    })
    if (error) console.error('agent task spend ledger failed')
  } catch {
    // Deliberately silent beyond the log above.
  }
}
