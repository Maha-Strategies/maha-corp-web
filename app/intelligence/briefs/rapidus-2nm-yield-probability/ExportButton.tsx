"use client";

import React from 'react';

export default function ExportButton() {
  return (
    <button 
      className="inline-flex items-center font-mono text-xs uppercase tracking-widest border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500 hover:text-black px-6 py-4 transition-all duration-200 text-amber-500"
      onClick={() => window.print()}
    >
      [ EXPORT BRIEF ↗ ]
    </button>
  );
}