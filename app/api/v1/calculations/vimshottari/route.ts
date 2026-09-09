import { celestialHandlers } from '@/lib/x402/celestial-route'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export const { GET, POST, OPTIONS } = celestialHandlers('celestial-vimshottari-timing')
