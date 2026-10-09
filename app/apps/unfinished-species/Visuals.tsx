import type { CSSProperties } from 'react'
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    atlas: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    book: 'M12 5v16 M3 3c4 0 6 1 9 3 3-2 5-3 9-3v15c-4 0-6 1-9 3-3-2-5-3-9-3z',
    companion: 'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5',
    research: 'M9 3h6 M10 3v7L4 20h16l-6-10V3 M7 15h10',
    save: 'M6 3h12v18l-6-4-6 4z',
    company: 'M4 21V7l8-4 8 4v14 M9 21v-5h6v5 M8 9h1 M15 9h1 M8 12h1 M15 12h1',
    arrow: 'M5 12h14 M13 6l6 6-6 6',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
    back: 'M19 12H5 M11 6l-6 6 6 6',
    member: 'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.atlas} /></svg>
}
export function BiologyArt({ variant = 0, style }: { variant?: number; style?: CSSProperties }) {
  return <svg viewBox="0 0 260 260" fill="none" style={style} aria-hidden="true">
    <circle cx="130" cy="130" r="105" stroke="currentColor" opacity=".12" />
    <circle cx="130" cy="130" r="80" stroke="currentColor" opacity=".12" strokeDasharray="3 6" />
    {variant % 3 === 0 ? <>
      <path d="M90 15C235 70 25 175 170 245M170 15C25 70 235 175 90 245" stroke="currentColor" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => { const y = 25 + i * 19; const x = 130 + 44 * Math.sin((y - 15) / 230 * Math.PI * 2); return <g key={i}><path d={`M${x} ${y}H${260-x}`} stroke="currentColor" opacity=".5" /><circle cx={x} cy={y} r="3" fill="currentColor" /><circle cx={260-x} cy={y} r="3" fill="currentColor" /></g> })}
    </> : variant % 3 === 1 ? <>
      {Array.from({ length: 9 }, (_, i) => { const angle = i * Math.PI * 2 / 9; const x = 130 + 70 * Math.cos(angle); const y = 130 + 70 * Math.sin(angle); return <g key={i}><path d={`M130 130L${x} ${y}`} stroke="currentColor" opacity=".5" /><circle cx={x} cy={y} r={i % 2 ? 11 : 7} stroke="currentColor" strokeWidth="2" /><circle cx={x} cy={y} r="3" fill="currentColor" opacity=".4" /></g> })}
      <circle cx="130" cy="130" r="25" stroke="currentColor" strokeWidth="2" /><circle cx="130" cy="130" r="12" fill="currentColor" opacity=".2" />
    </> : <>
      <path d="M42 127C56 38 212 40 218 123C234 208 61 225 42 127Z" stroke="currentColor" strokeWidth="2" />
      <path d="M56 132C48 75 191 50 202 128C212 199 75 197 56 132Z" stroke="currentColor" opacity=".4" />
      <ellipse cx="135" cy="123" rx="28" ry="36" stroke="currentColor" strokeWidth="2" />
      <circle cx="135" cy="123" r="12" fill="currentColor" opacity=".2" />
      {[ [80,110], [170,80], [175,165], [95,163], [185,125] ].map(([x,y],i) => <ellipse key={i} cx={x} cy={y} rx="10" ry="5" transform={`rotate(${i*37} ${x} ${y})`} stroke="currentColor" />)}
    </>}
  </svg>
}
