import { handleAstrologyPlatform } from '@/lib/astrology-platform-api'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120
export async function POST(request: Request) { return handleAstrologyPlatform(request) }
