import React from 'react';

export default function BriefLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0c] min-h-screen">
      {children}
    </div>
  );
}