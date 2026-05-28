import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Physics of Spirit | Tactical Brief',
  description: 'A tactical brief defining spirit as high-order negentropy. How biological surplus, cognitive focus, and relational architecture fight entropy.',
  alternates: { canonical: 'https://www.mahastrategies.com/doctrine/briefs/physics-of-spirit' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}