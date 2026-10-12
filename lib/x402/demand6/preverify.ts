import { priceFor, requirementsFor, x402Config } from '../config.ts'
import { createFacilitator } from '../facilitator.ts'
import { parsePaymentHeader, readPaymentSignature, matchRequirement, matchesPaymentContext } from '../protocol.ts'
import { resourceInfoFor, discoveryExtensionsFor } from '../discovery.ts'
/** Verify-only: refuses unfundable/context-mismatched requests before live preparation. Never settles. */
export async function verifyDemandBeforeWork(request: Request): Promise<boolean> {
  const config = x402Config()
  if (!config) throw new Error('payment_configuration_unavailable')
  const url = new URL(request.url), resource = priceFor(request.method, url.pathname, config)
  if (!resource) throw new Error('offer_not_enabled')
  const required = requirementsFor(resource, 'https://www.mahastrategies.com' + url.pathname, config)
  const parsed = parsePaymentHeader(readPaymentSignature(request.headers))
  if (!parsed.ok) return false
  const info = resourceInfoFor(resource, 'https://www.mahastrategies.com' + url.pathname)
  const extensions = await discoveryExtensionsFor(resource, info.url, required)
  const matched = matchRequirement(parsed.payment, required)
  if (!matched || !matchesPaymentContext(parsed.payment, info, extensions)) return false
  const facilitator = createFacilitator({ url: config.facilitatorUrl, authHeaders: config.facilitatorAuthHeaders, cdpCredentials: config.cdpCredentials })
  const verified = await facilitator.verify(parsed.payment, matched)
  const authorizer = (parsed.payment.payload.authorization as { from?: string })?.from
  return verified.ok && verified.payer.toLowerCase() === authorizer?.toLowerCase()
}
