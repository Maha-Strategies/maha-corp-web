import { mahaServiceMenu } from '../../lib/carp/menu.ts'

export const dynamic = 'force-static'
export function GET() {
  return Response.json(mahaServiceMenu, { headers: {
    'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  } })
}
