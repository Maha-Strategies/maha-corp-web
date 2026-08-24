'use client'

import { usePathname } from 'next/navigation'

import { siteThemeForPath } from '@/lib/site-theme'

export default function RouteThemeBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const surface = siteThemeForPath(pathname)
  const colorMode = pathname === '/audit' ? 'fixed-paper' : 'switchable'

  return (
    <div className="site-route flex-1" data-color-mode={colorMode} data-site-surface={surface}>
      {children}
    </div>
  )
}
