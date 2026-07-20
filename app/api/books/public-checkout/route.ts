import { createHash } from 'node:crypto'

import { createAgentInquiryLedger } from '@/lib/agent-inquiry-ledger'
import { createClientId, createCredentialId, createCredentialSecret } from '@/lib/agent-client-credentials'
import { jsonResponse } from '@/lib/agent-inquiries'
import { type BookId, bookCatalogConfig, createBookCheckoutId, isKnownBook } from '@/lib/books'
import { requestHash } from '@/lib/mps-credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mahastrategies.com'

function parseBody(value: unknown): { bookId: BookId; email: string; clientRequestId: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Request body must be a JSON object.')
  const body = value as Record<string, unknown>
  const bookId = body.bookId
  const email = body.email
  const clientRequestId = body.clientRequestId
  if (typeof bookId !== 'string' || !isKnownBook(bookId)) throw new Error('bookId must name an available book.')
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('email must be a valid email address.')
  if (typeof clientRequestId !== 'string' || clientRequestId.trim().length < 8 || clientRequestId.trim().length > 120 || /[\r\n]/.test(clientRequestId)) throw new Error('clientRequestId must contain between 8 and 120 characters on one line.')
  return { bookId: bookId as BookId, email: email.trim().toLowerCase(), clientRequestId: clientRequestId.trim() }
}

export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonResponse({ error: { code: 'unsupported_media_type', message: 'Content-Type must be application/json.' } }, 415)
  let input: ReturnType<typeof parseBody>
  try { input = parseBody(await request.json()) } catch (error) { return jsonResponse({ error: { code: 'invalid_request', message: error instanceof Error ? error.message : 'Invalid request.' } }, 400) }
  let config
  try { config = bookCatalogConfig() } catch { return jsonResponse({ error: { code: 'book_checkout_unavailable', message: 'Book purchases are temporarily unavailable.' } }, 503) }
  const priceId = config?.priceByBook[input.bookId]
  if (!config || !priceId) return jsonResponse({ error: { code: 'book_checkout_not_enabled', message: 'Book purchases are not currently available.' } }, 503)
  const ledger = createAgentInquiryLedger()
  if (!ledger) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'Book access is temporarily unavailable.' } }, 503)
  const clientId = createClientId(), credentialId = createCredentialId(), credential = createCredentialSecret(), checkoutId = createBookCheckoutId()
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  if ((await ledger.from('agent_clients').insert({ public_id: clientId, display_name: input.email, status: 'active' })).error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)
  if ((await ledger.from('agent_client_credentials').insert({ public_id: credentialId, client_id: clientId, label: `Book MCP access: ${input.bookId}`, secret_hash: createHash('sha256').update(credential).digest('hex'), secret_prefix: credential.slice(0, 14), allowed_offer_ids: [], allowed_capabilities: [], rate_limit_per_hour: 100, expires_at: expiresAt, status: 'pending_payment', billing_mode: 'internal_meter' })).error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase credential could not be prepared.' } }, 503)
  if ((await ledger.from('book_checkouts').insert({ public_id: checkoutId, client_id: clientId, credential_id: credentialId, book_id: input.bookId, request_hash: requestHash(input.clientRequestId), stripe_price_id: priceId, status: 'awaiting_payment' })).error) return jsonResponse({ error: { code: 'ledger_unavailable', message: 'The purchase could not be prepared.' } }, 503)
  const form = new URLSearchParams({ mode: 'payment', customer_email: input.email, client_reference_id: checkoutId, success_url: `${SITE_URL}/books/mcp-access?purchase=success`, cancel_url: `${SITE_URL}/books/mcp-access?purchase=cancelled`, 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1', 'metadata[bookCheckoutId]': checkoutId, 'metadata[bookId]': input.bookId })
  let stripe: { id?: string; url?: string }
  try { const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': checkoutId }, body: form, cache: 'no-store' }); stripe = await response.json() as typeof stripe; if (!response.ok) throw new Error() } catch { return jsonResponse({ error: { code: 'stripe_unavailable', message: 'Secure checkout could not be started.' } }, 502) }
  if (!stripe.id || !stripe.url) return jsonResponse({ error: { code: 'stripe_checkout_failed', message: 'Secure checkout could not be started.' } }, 502)
  await ledger.from('book_checkouts').update({ stripe_checkout_session_id: stripe.id, stripe_checkout_url: stripe.url }).eq('public_id', checkoutId)
  return jsonResponse({ checkoutId, checkoutUrl: stripe.url, credential, expiresAt, secretDisclosure: 'This credential is shown once and activates after signed payment confirmation.' }, 201)
}
