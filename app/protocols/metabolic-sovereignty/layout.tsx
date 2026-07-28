import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Metabolic Sovereignty | Maha Strategies',
  description: 'A protocol about attention, biological limits, and the relationship between digital environments and human agency.',
  alternates: { canonical: '/protocols/metabolic-sovereignty' },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return children }
