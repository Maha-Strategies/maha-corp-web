import type { Metadata } from 'next'

import ContextCompilerPlayground from './ContextCompilerPlayground'

export const metadata: Metadata = {
  title: 'Try the Context Compiler | Zero-install Playground',
  description: 'Compile a real four-document workload, inspect retained passages and provenance, estimate model cost avoided, and optionally settle one $0.001 x402 call.',
  alternates: { canonical: '/context-compiler/playground' },
  openGraph: {
    title: 'Try the Maha Context Compiler',
    description: 'Run a real 106 KB context-compilation workload in your browser. No installation or account required.',
    url: '/context-compiler/playground',
    type: 'website',
  },
}

export default function ContextCompilerPlaygroundPage() {
  return <ContextCompilerPlayground />
}
