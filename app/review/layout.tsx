import type { ReactNode } from 'react'

export default function ReviewerWorkspaceLayout({ children }: { children: ReactNode }) {
  return <div data-visual-system="cyber-light" data-visual-scope="reviewer">{children}</div>
}
