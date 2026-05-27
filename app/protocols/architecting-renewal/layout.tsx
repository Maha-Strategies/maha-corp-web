import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Sovereign Ecosystem: Architecting Renewal | Maha Strategies',
  description: 'The apex protocol for systems integration, unifying metabolic purity, digital defense, and kinetic action through The Maha Principle and Maha OS.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}