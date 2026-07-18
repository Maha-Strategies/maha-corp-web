import type { Metadata } from 'next'

import ApiDocs from './ApiDocs'

export const metadata: Metadata = {
  title: 'MPS API Reference | Maha Strategies',
  description: 'Claim-level provenance audits over an authenticated, prepaid API. Authentication, credits, idempotency, and full endpoint reference.',
  alternates: { canonical: '/docs' },
}

export default function DocsPage() {
  return <ApiDocs />
}
