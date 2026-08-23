// Compatibility route for A2A-aware discovery clients. Re-export the one
// canonical handler so the two paths cannot drift in content or headers.
export { GET, OPTIONS } from '../../api/discovery/agent-card/route'

// Next route-segment configuration must be declared in this file; it cannot
// be re-exported from the canonical handler.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
