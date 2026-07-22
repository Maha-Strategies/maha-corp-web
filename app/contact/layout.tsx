import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Maha Strategies',
  description: 'Start an inquiry with Maha Strategies for a fixed-scope Verified Research Brief, Rapid Intelligence Brief, MPS audit, or technical support.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Maha Strategies',
    description: 'Bring the decision, question, and deadline. Maha Strategies replies with a scope or a clear no-fit response.',
    url: 'https://www.mahastrategies.com/contact',
  },
}

export default function ContactLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
