'use client'

export default function CopyCitation({ text }: { text: string }) {
  return (
    <button 
      className="inline-block border border-zinc-600 text-zinc-300 px-6 py-3 text-xs font-bold uppercase tracking-widest hover:border-white hover:text-white transition-colors text-center"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy Citation
    </button>
  )
}