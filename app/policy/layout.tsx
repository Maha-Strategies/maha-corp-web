import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Policy & Statecraft | Maha Strategies',
  description: 'Applied research, legislative architecture, and policy solutions for reclaiming biological capital.',
};

export default function PolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      {/* This sub-navigation will appear on BOTH the main policy index 
        AND every individual policy article. 
      */}
      <nav className="w-full max-w-4xl flex justify-between items-center py-6 border-b border-gray-800 mb-8">
        <div className="font-mono text-xs text-indigo-500 font-bold uppercase tracking-widest">
          MAHA STRATEGIES / THINK TANK
        </div>
        <div className="flex gap-4 font-sans text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">Return to Root</Link>
          <span className="text-gray-700">|</span>
          <Link href="/policy" className="hover:text-white transition-colors">Policy Index</Link>
        </div>
      </nav>

      {/* This renders the actual page.tsx or [slug]/page.tsx content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}