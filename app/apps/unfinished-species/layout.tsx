import type { Metadata } from 'next'
import AtlasShell from './AtlasShell'
export const metadata: Metadata = {
  title: { default: 'Unfinished Species Atlas | Biology × AI', template: '%s | Unfinished Species Atlas' },
  description: 'Explore biology and AI through source-linked briefs, the complete book, and a research roadmap. Separate established science, inference, and speculation.',
  alternates: { canonical: '/apps/unfinished-species' },
  openGraph: { title: 'Unfinished Species Atlas', description: 'A field guide to biology, AI, and what comes next.', url: '/apps/unfinished-species', type: 'website' },
}
export default function Layout({ children }: { children: React.ReactNode }) { return <AtlasShell>{children}</AtlasShell> }
