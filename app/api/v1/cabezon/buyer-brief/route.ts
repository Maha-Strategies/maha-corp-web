import { buyerBriefHandlers } from '@/lib/x402/buyer-brief-route'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
export const {GET,POST,OPTIONS}=buyerBriefHandlers()
