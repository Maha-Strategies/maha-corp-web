import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hardware Sovereignty & Edge-Compute Intelligence | Maha Strategies',
  description: 'Securing infrastructural autonomy by deploying local, air-gapped edge-compute intelligence and breaking dependency on centralized cloud servers.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}