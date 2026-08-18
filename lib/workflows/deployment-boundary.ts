export type PrivateDeploymentPathDecision = 'allow' | 'redirect_console' | 'deny'

export function privateDeploymentPathDecision(pathname: string, mode: string | undefined): PrivateDeploymentPathDecision {
  if (mode !== 'private') return 'allow'
  if (pathname === '/') return 'redirect_console'
  if (pathname === '/admin/orchestration' || pathname === '/icon.png' || pathname.startsWith('/api/v1/orchestration/') || pathname.startsWith('/api/v1/workflows/')) return 'allow'
  return 'deny'
}
