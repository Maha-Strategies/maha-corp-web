import { microHandlers } from '@/lib/x402/micro-route'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const { GET, POST, OPTIONS } = microHandlers('reception-lineage-retrieval')
