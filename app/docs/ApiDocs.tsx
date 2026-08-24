'use client'

import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'

const scalarCyberLightCss = `
.scalar-app {
  --scalar-background-1: var(--intel-raised);
  --scalar-background-2: var(--intel-sunken);
  --scalar-background-3: var(--intel-surface);
  --scalar-background-accent: var(--intel-accent-soft);
  --scalar-color-1: var(--text-primary);
  --scalar-color-2: var(--text-secondary);
  --scalar-color-3: var(--text-muted);
  --scalar-color-accent: var(--intel-accent);
  --scalar-border-color: var(--intel-line);
  --scalar-sidebar-background-1: var(--intel-surface);
  --scalar-sidebar-color-1: var(--text-primary);
  --scalar-sidebar-color-2: var(--text-secondary);
  --scalar-sidebar-border-color: var(--intel-line);
  --scalar-sidebar-item-hover-background: var(--intel-accent-soft);
  --scalar-sidebar-item-active-background: var(--intel-sunken);
  --scalar-sidebar-search-background: var(--intel-raised);
  --scalar-sidebar-search-color: var(--text-muted);
  --scalar-sidebar-search-border-color: var(--intel-line);
  --scalar-font: var(--font-geist-sans), ui-sans-serif, sans-serif;
  --scalar-font-code: var(--font-geist-mono), ui-monospace, monospace;
  --scalar-radius: 0px;
  --scalar-border-width: 1px;
  --scalar-shadow-1: 3px 3px 0 var(--intel-shadow);
  --scalar-shadow-2: 4px 4px 0 var(--intel-shadow);
}

.scalar-app .sidebar,
.scalar-app .references-layout {
  background-image:
    linear-gradient(var(--intel-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--intel-grid) 1px, transparent 1px);
  background-size: 40px 40px;
}
`

export default function ApiDocs() {
  return <ApiReferenceReact configuration={{
    url: '/api/docs/openapi',
    darkMode: false,
    customCss: scalarCyberLightCss,
    hideClientButton: true,
    metaData: { title: 'MPS API Reference | Maha Strategies' },
  }} />
}
