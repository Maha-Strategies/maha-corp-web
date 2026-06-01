// app/intelligence/briefs/[slug]/ExportButton.tsx
'use client';

// NOTE: your original briefs imported a local ExportButton but its source was
// never provided to me. This is a clean, self-contained implementation that
// triggers the browser's print-to-PDF dialog (a common "export brief" pattern).
// If your original did something different (e.g. server-side PDF generation),
// replace this file with yours — the template only needs a default export.

export default function ExportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="block w-full text-center border border-gray-700 bg-[#111113] text-gray-300 font-mono text-[10px] tracking-widest py-3 hover:border-amber-500 hover:text-amber-500 transition-colors uppercase"
    >
      Export Brief &#8595;
    </button>
  );
}
