import React from 'react';

export default function RapidusYieldBriefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0c] min-h-screen selection:bg-amber-500 selection:text-black antialiased">
      {/* Structural Framing Grid Lines */}
      <div className="fixed inset-0 pointer-events-none border-x border-zinc-850/30 max-w-7xl mx-auto z-50" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}