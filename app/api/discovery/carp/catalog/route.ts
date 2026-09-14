import { mahaCarpSellerProfile } from '../../../../../lib/carp/seller.ts'

export const dynamic = 'force-static'
export function GET() {
  return Response.json(mahaCarpSellerProfile.offers, { headers: {
    'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*',
    'X-Content-Type-Options': 'nosniff',
  } })
}
