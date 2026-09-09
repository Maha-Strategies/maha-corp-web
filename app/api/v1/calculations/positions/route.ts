import { celestialHandlers } from '@/lib/x402/celestial-route'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Includes facilitator settlement and chain confirmation, not just calculation.
export const maxDuration = 60
export const { GET, POST, OPTIONS } = celestialHandlers('celestial-position-snapshot')
