import { cabezonPreviewErrorResponse } from '@/lib/cabezon-preview'
import { cabezonPreviewRouteHandlers } from '@/lib/cabezon-preview-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: RouteContext<'/api/integrations/cabezon/preview/lifecycles/[lifecycleId]/delivery'>) {
  try {
    const { lifecycleId } = await context.params
    return await cabezonPreviewRouteHandlers().deliver(request, lifecycleId)
  } catch (error) { return cabezonPreviewErrorResponse(error) }
}
