/**
 * Scheduled sweep that fails and refunds jobs past their deadline.
 *
 * This is not optional infrastructure. A GPU worker that crashes mid-run posts
 * no callback, so without this sweep the job stays `processing` forever and the
 * customer's reserved credits are never returned. Schedule it in vercel.json at
 * a period well under the shortest job timeout.
 */

import { reclaimExpiredJobs } from '@/lib/jobs/queue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorized = secret
    ? request.headers.get('authorization') === `Bearer ${secret}`
    : false
  if (!authorized) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { reclaimed } = await reclaimExpiredJobs()
  return Response.json({ reclaimed: reclaimed.length, jobIds: reclaimed }, { headers: { 'Cache-Control': 'no-store' } })
}
