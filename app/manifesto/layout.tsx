import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'The Maha Principle | The Sovereign Manifesto',
  description: 'The core doctrine of Maha Strategies. A blueprint for Biological Sovereignty, Mental Focus, and National Renewal.',
  alternates: { canonical: 'https://www.mahastrategies.com/manifesto' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}