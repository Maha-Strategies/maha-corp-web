import { cabezonPreviewErrorResponse } from '@/lib/cabezon-preview'
import { cabezonPreviewRouteHandlers } from '@/lib/cabezon-preview-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try { return await cabezonPreviewRouteHandlers().offers(request) }
  catch (error) { return cabezonPreviewErrorResponse(error) }
}
