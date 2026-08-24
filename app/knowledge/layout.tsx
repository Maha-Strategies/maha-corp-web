import type { ReactNode } from 'react'

import styles from './knowledge-cyber-light.module.css'

export default function KnowledgeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={styles.root}
      data-visual-system="cyber-light"
      data-visual-scope="knowledge"
    >
      {children}
    </div>
  )
}
