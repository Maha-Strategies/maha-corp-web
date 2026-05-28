import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Start Here | Protocol 001: The Stronghold',
  description: 'A tactical field manual for resisting Metabolic Colonialism. Secure your perimeter and download the structural defense assets.',
  alternates: { canonical: 'https://www.mahastrategies.com/start' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}