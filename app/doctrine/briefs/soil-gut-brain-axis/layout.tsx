import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Soil-Gut-Brain Axis | Tactical Brief',
  description: 'A tactical brief on biological sovereignty, the microbiome, and the consequences of industrialized agriculture.',
  alternates: { canonical: 'https://www.mahastrategies.com/doctrine/briefs/soil-gut-brain-axis' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}