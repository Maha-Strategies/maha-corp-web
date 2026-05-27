import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Algorithmic Trance & Metabolic Sovereignty | Maha Strategies',
  description: 'Quantifying cognitive extraction and establishing a baseline of Metabolic Purity as the substrate of biological sovereignty.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}