'use client'

import { useState } from 'react'
import { filterPolicyEntries, type PolicySearchEntry } from '../../lib/policy-expansion-search'
import styles from './PolicyReader.module.css'

export default function PolicyQuestionSearch({ entries, areas }: { entries: PolicySearchEntry[]; areas: { id: string; label: string }[] }) {
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('all')
  const results = filterPolicyEntries(entries, query, area)
  return <section aria-labelledby="policy-search-title" className={styles.section}>
    <h2 id="policy-search-title">What issue do you want answered?</h2>
    <p id="policy-search-help">Search available options briefs, existing proposals and methodology—not the unresearched candidate map. Search stays in this page and is not sent to a server.</p>
    <div className={styles.filters}>
      <div><label htmlFor="policy-query">Question or topic</label><input id="policy-query" type="search" value={query} onChange={e => setQuery(e.target.value)} aria-describedby="policy-search-help" placeholder="For example: housing, costs, accountability" autoComplete="off" /></div>
      <div><label htmlFor="policy-area">Area</label><select id="policy-area" value={area} onChange={e => setArea(e.target.value)}><option value="all">All available content</option>{areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}<option value="methodology">Methodology</option></select></div>
      <button type="button" onClick={() => { setQuery(''); setArea('all') }}>Clear filters</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{results.length} {results.length === 1 ? 'result' : 'results'}</p>
    {results.length === 0 ? <p>No matching content yet. Try a broader term or clear the filters. A planned question is not a completed answer.</p> : <ul className={styles.cards}>{results.map(e => <li key={e.href} className={styles.card}><p className={styles.badge}>{e.label}</p><h3><a href={e.href}>{e.title}</a></h3><p>{e.description}</p></li>)}</ul>}
    <noscript>All entries are visible without JavaScript. Use browser Find or the area links below; interactive filters require JavaScript.</noscript>
  </section>
}
