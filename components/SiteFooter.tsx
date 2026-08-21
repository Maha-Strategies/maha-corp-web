'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { siteThemeForPath } from '@/lib/site-theme'
import {
  FOOTER_COMPANY_NAVIGATION,
  FOOTER_DEVELOPER_NAVIGATION,
} from '@/lib/navigation/site-navigation'

const developerLinks = FOOTER_DEVELOPER_NAVIGATION
const companyLinks = FOOTER_COMPANY_NAVIGATION

export default function SiteFooter() {
  const theme = siteThemeForPath(usePathname())

  return (
    <footer data-theme={theme} className="site-chrome border-t border-[var(--chrome-border)] bg-[var(--chrome-surface)] px-6 py-10 text-[var(--chrome-muted)]">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3">
        <div>
          <p className="font-editorial text-lg font-semibold text-[var(--chrome-text)]">Maha Strategies LLC</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--chrome-muted)]">Independent research, evidence assurance, and developer infrastructure for governed AI systems.</p>
        </div>
        <nav aria-label="Developer infrastructure footer links">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--chrome-text)]">Developers</p>
          <ul className="mt-4 space-y-3 text-sm">
            {developerLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-[var(--chrome-text)]">{link.name}</Link></li>)}
          </ul>
        </nav>
        <nav aria-label="Company footer links">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--chrome-text)]">Explore</p>
          <ul className="mt-4 space-y-3 text-sm">
            {companyLinks.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-[var(--chrome-text)]">{link.name}</Link></li>)}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-[var(--chrome-border)] pt-6 font-mono text-[10px] uppercase tracking-widest text-[var(--chrome-muted)]">© {new Date().getFullYear()} Maha Strategies LLC</p>
    </footer>
  )
}
