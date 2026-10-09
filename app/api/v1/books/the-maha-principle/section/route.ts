import { licensedSectionHandlers } from '@/lib/x402/licensed-book-section-route'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const { GET, POST, OPTIONS } = licensedSectionHandlers('the-maha-principle')
