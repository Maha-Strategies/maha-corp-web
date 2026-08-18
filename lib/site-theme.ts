export type SiteTheme = 'paper' | 'operator'

const OPERATOR_PREFIXES = ['/admin', '/dashboard', '/operations'] as const

export function siteThemeForPath(pathname: string): SiteTheme {
  return OPERATOR_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    ? 'operator'
    : 'paper'
}
