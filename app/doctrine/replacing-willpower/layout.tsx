import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Replacing Willpower with Architecture | Maha Strategies',
  description: 'Quantizing generative AI for edge-compute interventions. Why passive telemetry fails and how to build a decentralized cognitive circuit breaker.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}