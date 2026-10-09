'use client'

import type { LedgerFeed } from '@/lib/civic/ledger-feed'
import type { LedgerReceipt } from '@/lib/civic/transparency-ledger'
import styles from './CivicDashboard.module.css'

const usdc = (units: string) => { const digits = units.padStart(7, '0'); return `${digits.slice(0, -6)}.${digits.slice(-6)}` }
export default function LedgerTable({ feed, renderReceipt }: { feed: LedgerFeed; renderReceipt: (receipt: LedgerReceipt) => React.ReactNode }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Public civic ledger records"><table className={`${styles.economicTable} ${styles.ledgerTable}`}><caption>Public declarations · transfer confirmation requires a separate chain check</caption><thead><tr>{['Sequence / time (UTC)', 'Type / channel', 'Counterparty / purpose', 'USDC', 'Base transaction / evidence', 'Receipt'].map(text => <th scope="col" key={text}>{text}</th>)}</tr></thead><tbody>
    {feed.receipts.map(receipt => { const event = receipt.event; return <tr key={receipt.digest}>
      <th scope="row">#{receipt.sequence}<time className={styles.sourceNote} dateTime={event.occurredAt}>{event.occurredAt}</time></th>
      <td>{event.kind}<span className={styles.sourceNote}>{event.category ?? 'Category unspecified'}</span><span className={styles.sourceNote}>{event.settlementChannel ?? 'Channel unspecified'}</span></td>
      <td><strong>{event.counterpartyLabel ?? 'Label not supplied'}</strong><p>{event.description}</p>{event.kind !== 'decision' && <details><summary>Declared transfer parties</summary><code className={styles.digest}>From: {event.transfer.from}<br />To: {event.transfer.to}</code></details>}</td>
      <td>{event.kind === 'decision' ? '—' : usdc(event.amountBaseUnits)}</td>
      <td>{event.kind !== 'decision' && <><a href={`https://basescan.org/tx/${event.transfer.transactionHash}`} target="_blank" rel="noreferrer">{event.transfer.transactionHash}</a><span className={styles.sourceNote}>Log {event.transfer.logIndex} · unverified transfer</span></>}{event.evidence.map(source => <details key={source.url + source.citation}><summary>{source.citation}</summary><a href={source.url} target="_blank" rel="noreferrer">Source ↗</a>{source.digest && <code className={styles.digest}>{source.digest}</code>}</details>)}</td>
      <td>{renderReceipt(receipt)}</td>
    </tr> })}
  </tbody></table></div>
}
