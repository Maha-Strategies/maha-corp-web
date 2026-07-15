import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Personal Protocols | The Stronghold',
  description: 'Personal protocols and practical field assets from The Maha Principle, for protecting attention, food environments, and family routines.',
  alternates: { canonical: 'https://www.mahastrategies.com/start' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
