import Link from 'next/link'

const developerLinks = [
  { href: '/developers', label: 'Developer infrastructure' },
  { href: '/docs', label: 'API documentation' },
  { href: '/enterprise-mcp-gateway', label: 'Enterprise MCP Gateway' },
  { href: '/context-compiler', label: 'Context Compiler' },
] as const

const companyLinks = [
  { href: '/tools', label: 'Tools & API' },
  { href: '/mps/preflight', label: 'MPS Preflight' },
  { href: '/about', label: 'About Maha' },
  { href: '/contact', label: 'Contact' },
] as const

export default function SiteFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-[#08080a] px-6 py-10 text-zinc-400">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Maha Strategies LLC</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500">Independent research, evidence assurance, and developer infrastructure for governed AI systems.</p>
        </div>
        <nav aria-label="Developer infrastructure footer links">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">Developers</p>
          <ul className="mt-4 space-y-3 text-sm">
            {developerLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Company footer links">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Explore</p>
          <ul className="mt-4 space-y-3 text-sm">
            {companyLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-zinc-900 pt-6 font-mono text-[10px] uppercase tracking-widest text-zinc-700">© {new Date().getFullYear()} Maha Strategies LLC</p>
    </footer>
  )
}
