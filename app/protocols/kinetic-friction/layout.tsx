import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Iron Engine & The Necessity of Friction | Maha Strategies',
  description: 'Overcoming the frictionless digital grid through kinetic separation and engineered resistance to restore neurobiological drive.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}