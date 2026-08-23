'use client'

export default function CopyCitation({ text }: { text: string }) {
  return (
    <button 
      className="evidence-action evidence-action--secondary"
      onClick={() => navigator.clipboard.writeText(text)}
    >
      Copy Citation
    </button>
  )
}
