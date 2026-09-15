import { handleBasicJyotisha } from '@/lib/jyotisha-basic-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Do not expose the dependency-injection parameter to Next's route context.
export function POST(request: Request) { return handleBasicJyotisha(request) }
export function GET(request: Request) { return handleBasicJyotisha(request) }
