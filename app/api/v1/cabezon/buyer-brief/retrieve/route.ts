import { buyerBriefHandlers } from '@/lib/x402/buyer-brief-route'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=30
const handlers=buyerBriefHandlers()
export const POST=handlers.RETRIEVE
export const OPTIONS=handlers.OPTIONS
