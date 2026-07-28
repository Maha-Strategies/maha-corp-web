import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Necessity of Friction | Maha Strategies',
  description: 'A protocol for restoring deliberate effort, delay, and resistance to digital environments designed for instant reward.',
  alternates: { canonical: '/protocols/kinetic-friction' },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return children }
