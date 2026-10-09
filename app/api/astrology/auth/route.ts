import { handleAstrologyAuth } from '@/lib/astrology-auth'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request: Request) { return handleAstrologyAuth(request) }
