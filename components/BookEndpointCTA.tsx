import Link from 'next/link'

// "Book-as-an-Endpoint" upsell. The prose is free to read on this page; the CTA
// pitches the paid, structured MCP endpoint. Server component — no client JS.
export default function BookEndpointCTA({
  title,
  price,
  href = '/docs',
  placement = 'inline',
}: {
  title: string
  price?: string
  href?: string
  placement?: 'top' | 'bottom' | 'inline'
}) {
  const priceLabel = price ? ` for ${price}` : ''
  return (
    <aside className="mt-16 border border-emerald-800/60 bg-emerald-950/20 p-7 sm:p-9 relative overflow-hidden">
      <div className="absolute top-0 left-0 h-full w-1 bg-emerald-500" />
      <p className="font-mono text-xs text-emerald-300 tracking-widest uppercase mb-4">[ Book as an endpoint ]</p>
      <h2 className="text-2xl sm:text-3xl font-light text-white mb-4">
        Read <span className="text-emerald-300">{title}</span> for free — or mount it into your IDE.
      </h2>
      <p className="text-zinc-400 leading-relaxed max-w-2xl mb-7">
        Every word is on this page, free and open. Or connect the book directly to Claude Code, Cursor, or any
        MCP client as a secure, queryable server{priceLabel} — so your agent can pull the exact chapter it needs
        instead of scrolling a wall of text.
      </p>
      <Link
        href={href}
        className="inline-block bg-emerald-400 text-black font-mono font-bold text-xs tracking-widest uppercase px-7 py-4 hover:bg-emerald-300 transition-colors"
      >
        Mount as MCP endpoint ↗
      </Link>
      {placement === 'bottom' && (
        <p className="mt-5 font-mono text-[11px] text-zinc-500 tracking-widest uppercase">
          Secure · entitlement-gated · your credential never leaves your machine
        </p>
      )}
    </aside>
  )
}
