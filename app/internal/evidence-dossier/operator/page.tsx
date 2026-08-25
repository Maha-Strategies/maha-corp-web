import type { Metadata } from 'next'

import OperatorConsole from './OperatorConsole'

export const metadata: Metadata = {
  title: 'Evidence dossier operator console | Maha Strategies',
  description: 'Internal local-only validation console for evidence dossier packages.',
  robots: { index: false, follow: false, nocache: true },
}

/*
 * Internal operator console. Server component renders a shell only; all
 * validation happens in the browser and nothing is uploaded.
 *
 * There is no route handler behind this page, no form action and no fetch. The
 * client component is the whole surface.
 */
export default function EvidenceDossierOperatorPage() {
  return <OperatorConsole />
}
