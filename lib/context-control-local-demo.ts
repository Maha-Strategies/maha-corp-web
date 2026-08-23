/**
 * A deterministic, no-secret evaluator journey for Context Control.
 *
 * These inputs and evidence are synthetic. The useful result is that the
 * shipped transport can make three bounded, locally checkable decisions:
 * whether an envelope is admissible, whether a gateway artifact is complete,
 * and whether metadata-only evidence is structurally coherent.
 */
export const LOCAL_DEMO_REQUEST = {
  model: 'synthetic-evaluation-model',
  messages: [],
  maha_context: {
    task: 'Evaluate the synthetic policy excerpt under a 512-token budget.',
    tokenBudget: 512,
    documents: [
      { id: 'synthetic-policy-1', text: 'Synthetic policy excerpt. No customer or production source text is included.' },
    ],
  },
} as const

export const LOCAL_DEMO_EXPECTATIONS = {
  requestOutcome: 'proceed',
  gateway: 'wso2',
  evidenceStatus: 'ok',
} as const

export function isSuccessfulLocalDemo(result: {
  request?: { outcome?: unknown }
  gateway?: { status?: unknown }
  evidence?: { status?: unknown; findings?: unknown }
}): boolean {
  return result.request?.outcome === LOCAL_DEMO_EXPECTATIONS.requestOutcome &&
    result.gateway?.status === 'ok' &&
    result.evidence?.status === LOCAL_DEMO_EXPECTATIONS.evidenceStatus &&
    Array.isArray(result.evidence?.findings)
}
