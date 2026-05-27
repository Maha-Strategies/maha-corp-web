import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Saturnian Perimeter & The Digital Firewall | Maha Strategies',
  description: 'Constructing a rigid digital boundary to counter runaway algorithmic amplification, restrict synthetic noise, and protect cognitive yield.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}