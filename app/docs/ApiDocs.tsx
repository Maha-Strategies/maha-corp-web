'use client'

import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

export default function ApiDocs() {
  return <ApiReferenceReact configuration={{
    url: '/api/docs/openapi',
    darkMode: true,
    hideClientButton: true,
    metaData: { title: 'MPS API Reference | Maha Strategies' },
  }} />
}
