import { handleAstrologyMobile } from '@/lib/astrology-mobile-api'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export function POST(request: Request) { return handleAstrologyMobile(request) }
export function OPTIONS(request: Request) { return handleAstrologyMobile(request) }
