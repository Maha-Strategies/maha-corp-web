import { demand6Handlers } from '@/lib/x402/demand6/route'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const { GET, POST, OPTIONS } = demand6Handlers('live-x402-payment-preflight')
