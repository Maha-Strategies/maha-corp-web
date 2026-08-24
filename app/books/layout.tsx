import type { ReactNode } from 'react'

import styles from '../intelligence/intelligence-cyber-light.module.css'

export default function BooksLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.root} data-visual-system="cyber-light" data-visual-scope="books">
      {children}
    </div>
  )
}
