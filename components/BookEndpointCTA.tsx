import Link from 'next/link'

// "Book-as-an-Endpoint" upsell. The prose is free to read on this page; the CTA
// pitches the paid, structured MCP endpoint. Server component — no client JS.
export default function BookEndpointCTA({
  title,
  price,
  href = '/books/mcp-access',
  placement = 'inline',
}: {
  title: string
  price?: string
  href?: string
  placement?: 'top' | 'bottom' | 'inline'
}) {
  const priceLabel = price ? ` for ${price}` : ''
  return (
    <aside className="evidence-status-surface evidence-status-surface--verified relative mt-16 overflow-hidden p-7 sm:p-9">
      <p className="evidence-status-label mb-4">[ Book as an endpoint ]</p>
      <h2 className="mb-4 text-2xl font-light text-[var(--text-primary)] sm:text-3xl">
        Read <span className="font-medium text-[var(--status-verified)]">{title}</span> for free — or mount it into your IDE.
      </h2>
      <p className="mb-7 max-w-2xl leading-relaxed text-[var(--text-secondary)]">
        Every word is on this page, free and open. The paid entitlement adds a chunk-addressable API and local MCP
        mount for Claude Code, Cursor, or another MCP client{priceLabel} — so your agent can retrieve an exact,
        heading-addressable passage without scraping the web edition.
      </p>
      <Link
        href={href}
        className="evidence-action evidence-action--secondary inline-block"
      >
        See MCP access terms ↗
      </Link>
      {placement === 'bottom' && (
        <p className="mt-5 font-mono text-[11px] tracking-widest text-[var(--text-muted)] uppercase">
          Secure · entitlement-gated · your credential never leaves your machine
        </p>
      )}
    </aside>
  )
}
