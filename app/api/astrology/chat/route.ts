import { handleAstrologyChat } from '@/lib/astrology-chat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 45

export function POST(request: Request) { return handleAstrologyChat(request) }
