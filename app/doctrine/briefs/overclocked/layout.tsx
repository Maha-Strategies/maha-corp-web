import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Overclocked: The Physics of Anxiety | Tactical Brief',
  description: 'A tactical brief mapping modern anxiety to CPU thermal throttling, sympathetic nervous system arousal, and allostatic overload.',
  alternates: { canonical: 'https://www.mahastrategies.com/doctrine/briefs/overclocked' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}