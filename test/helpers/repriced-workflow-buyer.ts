// Test consumer of the public generic buyer: trusted explicit new prices, not
// silent changes to the legacy workflow SDK or its historical capsules.
import { prepareModularPurchase, submitModularPurchase, type ModularCapsule, type ModularBuyerContract } from '../../lib/x402/modular-buyer.ts'
import { parseWorkflowInput, workflowResultSchema, type WorkflowId } from '../../lib/x402/workflow/contracts.ts'
import { endpointById } from '../../lib/api-v1/endpoints.registry.ts'
import { demandDigest } from '../../lib/x402/demand6/digest.ts'
import type { TypedDataSigner } from '../../lib/x402/client.ts'
const contract = (id: WorkflowId, inputHash?: string): ModularBuyerContract => {
  const e = endpointById(id)!
  return { id, path: e.path, amount: e.amount, recoverySeconds: 86400,
    validateInput: input => parseWorkflowInput(id, input), validateOutput: data => {
      const p = workflowResultSchema(id).parse(data)
      if (inputHash && p.inputHash !== inputHash || p.resultHash !== demandDigest(p.result)
        || p.receiptDigest !== demandDigest({ version: p.version, productId: id, inputHash: p.inputHash, resultHash: p.resultHash })) throw Error('result_binding_mismatch')
      return p
    } }
}
export type RepricedCapsule = ModularCapsule & { url: string }
export async function prepareRepricedWorkflowPurchase(o: { productId: WorkflowId; input: unknown; network: string; payer: string;
  maximumAmount: bigint; signTypedData: TypedDataSigner; persist(c: RepricedCapsule): Promise<void>; fetchImpl?: typeof fetch; now?: number; recoverySecret?: string }) {
  if (o.network !== 'eip155:8453') throw Error('unsupported_modular_network')
  const c = contract(o.productId), url = 'https://www.mahastrategies.com' + c.path
  const capsule = await prepareModularPurchase(c, { ...o, secret: o.recoverySecret, persist: async cap => o.persist({ ...cap, url }) })
  return { ...capsule, url }
}
export async function submitRepricedWorkflowPurchase(c: RepricedCapsule, o: { fetchImpl?: typeof fetch; now?: number; recovery?: boolean } = {}) {
  const result = await submitModularPurchase(contract(c.id as WorkflowId, c.headers['X-Maha-Input-Hash']), c,
    { ...o, recovery: o.recovery ? 'retained-result' : undefined })
  return { replayed: false, status: null, ...result }
}
export const recoverRepricedWorkflowPurchase = (c: RepricedCapsule, o: { fetchImpl?: typeof fetch; now?: number } = {}) => submitRepricedWorkflowPurchase(c, { ...o, recovery: true })
