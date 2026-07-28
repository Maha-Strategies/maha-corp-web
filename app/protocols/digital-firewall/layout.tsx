import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Digital Firewall | Maha Strategies',
  description: 'A practical framework for creating deliberate information boundaries in an environment built to amplify noise.',
  alternates: { canonical: '/protocols/digital-firewall' },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return children }
