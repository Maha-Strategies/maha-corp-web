import { bookSectionPost } from '@/lib/x402/book-section-route'
import { VOLCANIC_ENGINE_SECTION_OFFER } from '@/lib/x402/offers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10

export const POST = bookSectionPost('the-volcanic-engine', VOLCANIC_ENGINE_SECTION_OFFER)
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS', 'Cache-Control': 'no-store' } }) }
