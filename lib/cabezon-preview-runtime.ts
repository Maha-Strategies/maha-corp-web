import 'server-only'

import {
  CabezonPreviewError,
  cabezonPreviewConfigFromEnvironment,
  createCabezonPreviewHandlers,
} from './cabezon-preview.ts'
import { productionCabezonPreviewStore } from './cabezon-preview-store.ts'

export function cabezonPreviewRouteHandlers() {
  const config = cabezonPreviewConfigFromEnvironment()
  const store = productionCabezonPreviewStore()
  if (!store) throw new CabezonPreviewError(503, 'cabezon_preview_unconfigured', 'CABEZON Preview lifecycle store is not configured.')
  return createCabezonPreviewHandlers({ config, store })
}
