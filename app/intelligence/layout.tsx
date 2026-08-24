import type { ReactNode } from 'react'

import styles from './intelligence-cyber-light.module.css'

/**
 * Owns the cyber-light surface for the whole /intelligence subtree.
 *
 * The markers mirror the Books convention but declare their own scope: this is
 * a sibling vocabulary, not an inheritance of the frozen /books overlay.
 */
export default function IntelligenceLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-visual-system="cyber-light" data-visual-scope="intelligence">
      {children}
    </div>
  )
}
