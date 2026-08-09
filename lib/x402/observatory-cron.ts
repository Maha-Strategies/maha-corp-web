import { timingSafeEqual } from 'node:crypto'

export function authorizeObservatoryCron(request: Request, token = process.env.CRON_SECRET): boolean {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  if (!token || !supplied) return false
  const expected = Buffer.from(token), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
