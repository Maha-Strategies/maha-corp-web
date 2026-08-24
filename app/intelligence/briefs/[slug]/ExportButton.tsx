// app/intelligence/briefs/[slug]/ExportButton.tsx
'use client';

// Triggers the browser's print-to-PDF dialog. Styling comes from the
// intelligence cyber-light module so the control matches the rest of the
// subtree and keeps a visible focus ring.

import styles from '../../intelligence-cyber-light.module.css';

export default function ExportButton() {
  return (
    <button type="button" onClick={() => window.print()} className={styles.action}>
      Export Brief &#8595;
    </button>
  );
}
