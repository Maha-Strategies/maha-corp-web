import { handleMobileRevenueCatWebhook } from '@/lib/astrology-mobile-billing'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export function POST(request:Request){return handleMobileRevenueCatWebhook(request)}
