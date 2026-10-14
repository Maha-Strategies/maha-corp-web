import { dispatchEndpoint, endpointOptions } from '@/lib/api-v1/router'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const GET = dispatchEndpoint
export const POST = dispatchEndpoint
export const OPTIONS = endpointOptions
