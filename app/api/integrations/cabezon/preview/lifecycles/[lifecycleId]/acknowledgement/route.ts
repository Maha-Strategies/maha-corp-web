import { cabezonPreviewErrorResponse } from '@/lib/cabezon-preview'
import { cabezonPreviewRouteHandlers } from '@/lib/cabezon-preview-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: RouteContext<'/api/integrations/cabezon/preview/lifecycles/[lifecycleId]/acknowledgement'>) {
  try {
    const { lifecycleId } = await context.params
    return await cabezonPreviewRouteHandlers().acknowledge(request, lifecycleId)
  } catch (error) { return cabezonPreviewErrorResponse(error) }
}
