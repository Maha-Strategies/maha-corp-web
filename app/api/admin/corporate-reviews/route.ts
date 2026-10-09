import { handleCorporateReview } from '../../../../lib/corporate-review-service.ts'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const POST = (request: Request) => handleCorporateReview(request)
