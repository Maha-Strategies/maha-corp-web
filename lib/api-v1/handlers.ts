import { WORKFLOW_IDS, WORKFLOW_INPUTS, parseWorkflowInput, workflowResultSchema, type WorkflowId } from '../x402/workflow/contracts.ts'
import { buildWorkflowProduct } from '../x402/workflow/products.ts'
import type { HandlerContract } from './types.ts'
import { BOOK_INPUT, BOOK_OUTPUT, bookMetadata } from './book-catalogue.ts'
import { executeBookSection } from './book-handler.ts'
import { isLegacyPort, legacyAdapter } from './legacy-adapters.ts'
import { PUBLICATION_PRODUCTS, publicationHandler, type PublicationProductId } from './publishing/products.ts'
import { batch4Audit } from './batch4-audits.ts'
import { auditHandler } from './batch4-audit-core.ts'
import { BOOK_PACK_IDS, bookPackHandler, type BookPackId } from './batch4-book-packs.ts'
import { batch5Audit } from './batch5-audits.ts'
import { batch6Audit } from './batch6-audits.ts'
import { batch7Audit } from './batch7-audits.ts'
import { batch8Audit } from './batch8-audits.ts'
/** Business logic only: no Request, payment, routing, Redis or wallet code here. */
export function handlerFor(id: string, amount?: string): HandlerContract | undefined {
  const eighth = batch8Audit(id)
  if (eighth) { if (!amount) throw Error('registry_quote_amount_required'); return auditHandler(eighth, amount) }
  const seventh = batch7Audit(id)
  if (seventh) { if (!amount) throw Error('registry_quote_amount_required'); return auditHandler(seventh, amount) }
  const sixth = batch6Audit(id)
  if (sixth) { if (!amount) throw Error('registry_quote_amount_required'); return auditHandler(sixth, amount) }
  const fifth = batch5Audit(id)
  if (fifth) { if (!amount) throw Error('registry_quote_amount_required'); return auditHandler(fifth, amount) }
  const audit = batch4Audit(id)
  if (audit) { if (!amount) throw Error('registry_quote_amount_required'); return auditHandler(audit, amount) }
  if (BOOK_PACK_IDS.some(p => p === id)) { if (!amount) throw Error('registry_quote_amount_required'); return bookPackHandler(id as BookPackId, amount) }
  if (isLegacyPort(id)) return legacyAdapter(id, amount)
  if (PUBLICATION_PRODUCTS.some(p => p.id === id)) return publicationHandler(id as PublicationProductId)
  if (bookMetadata(id)) return { input: BOOK_INPUT, output: BOOK_OUTPUT, execute: input => executeBookSection(id, input) }
  if (!WORKFLOW_IDS.includes(id as WorkflowId)) return undefined
  const workflowId = id as WorkflowId
  return { input: WORKFLOW_INPUTS[workflowId], output: workflowResultSchema(workflowId),
    execute: async input => buildWorkflowProduct(workflowId, parseWorkflowInput(workflowId, input)) }
}
