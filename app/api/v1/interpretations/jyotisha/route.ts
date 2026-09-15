import { handleJyotishaReading } from '@/lib/jyotisha-reading-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function POST(request: Request) {
  return handleJyotishaReading(request, process.env.MAHA_JYOTISHA_PILOT_TOKEN)
}
