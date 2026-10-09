'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import type { PolicyGraph, SimulationReceipt } from '@/lib/civic/policy-graph'
import type { TownhallReceipt } from '@/lib/civic/townhall-agent'
import type { SpendingAuditReceipt } from '@/lib/civic/spending-audit'
import { ledgerFeedBundle } from '@/lib/civic/ledger-feed'
import PolicySimulator from './PolicySimulator'
import LedgerTable from './LedgerTable'
import AiSafetyParticipation from './AiSafetyParticipation'
import PublicParticipation from './PublicParticipation'
import ModelEvidenceLab from './ModelEvidenceLab'
import CivicAiEvaluations from './CivicAiEvaluations'
import { useLiveLedger } from './useLiveLedger'
import styles from './CivicDashboard.module.css'

function useCivicRequest<T>(initial: T | null = null) {
  const [data, setData] = useState<T | null>(initial), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function run(url: string, body?: unknown) {
    setBusy(true); setError(''); setData(null)
    try {
      const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The request could not be completed.')
      setData(result)
      return result as T
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Request failed.'); return null }
    finally { setBusy(false) }
  }
  return { data, busy, error, run }
}

function downloadReceipt(value: unknown, filename: string) {
  downloadText(JSON.stringify(value, null, 2), filename, 'application/json')
}

function downloadText(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Receipt({ digest, value, filename }: { digest: string; value: unknown; filename: string }) {
  return <details className={styles.receipt}><summary>Inspect receipt · SHA-256</summary>
    <p className={styles.muted}>This digest binds the recorded inputs and output. It establishes integrity of those bytes.</p>
    <code className={styles.digest}>{digest}</code>
    <button type="button" className={styles.secondary} onClick={() => downloadReceipt(value, filename)}>Download receipt JSON</button>
  </details>
}

function Feedback({ busy, error }: { busy: boolean; error: string }) {
  return <div aria-live="polite">{busy && <p className={styles.muted}>Inspecting the supplied evidence…</p>}{error && <p role="alert" className={styles.error}>{error}</p>}</div>
}
function Panel({ id, number, title, intro, children }: { id: string; number: string; title: string; intro: string; children: ReactNode }) {
  return <section id={id} className={styles.panel} aria-labelledby={`${id}-title`}>
    <header className={styles.panelHeader}><span className={styles.number}>{number}</span><div><h2 id={`${id}-title`}>{title}</h2><p>{intro}</p></div></header>
    {children}
  </section>
}
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 3 })
const usd = (cents: string) => {
  const amount = BigInt(cents), dollars = (amount / BigInt(100)).toLocaleString('en-US')
  return `$${dollars}.${(amount % BigInt(100)).toString().padStart(2, '0')}`
}

export default function CivicDashboard({ graph, initialSimulation, syntheticSpending }: {
  graph: PolicyGraph; initialSimulation: SimulationReceipt; syntheticSpending: string
}) {
  const [policyId, setPolicyId] = useState(graph.nodes[0].id)
  const [question, setQuestion] = useState('What evidence supports the projected savings?')
  const [history, setHistory] = useState<TownhallReceipt[]>([])
  const [format, setFormat] = useState<'json' | 'csv'>('json'), [spending, setSpending] = useState(syntheticSpending)
  const [concentration, setConcentration] = useState(60), [noncompetitiveUsd, setNoncompetitiveUsd] = useState('10000000')
  const townhall = useCivicRequest<TownhallReceipt>()
  const audit = useCivicRequest<SpendingAuditReceipt>(), ledger = useLiveLedger()
  const chain = useCivicRequest<{ status: string; reason?: string; transactionHash?: string; limitation: string; verificationInput?: { checkpoint: { digest: string }; publisher: string; transactionHash: string } }>()
  const [publisher, setPublisher] = useState(''), [anchorHash, setAnchorHash] = useState('')
  const policy = graph.nodes.find(node => node.id === policyId)!
  const currentAnchor = chain.data?.verificationInput?.checkpoint.digest === ledger.data?.head.digest
    && chain.data?.verificationInput?.publisher === publisher && chain.data?.verificationInput?.transactionHash === anchorHash
  async function ask(event: FormEvent) {
    event.preventDefault()
    const answer = await townhall.run('/api/civic/townhall', { policyId, question })
    if (answer) setHistory(previous => [...previous, answer].slice(-10))
  }
  function scan(event: FormEvent) {
    event.preventDefault()
    void audit.run('/api/civic/audit', { format, data: spending, thresholds: {
      concentrationPercent: concentration, minimumGroupRecords: 3, noncompetitiveAmountUsdCents: (BigInt(noncompetitiveUsd) * BigInt(100)).toString(),
    } })
  }
  return <div className={styles.dashboard}>
    <nav className={styles.nav} aria-label="Civic workspaces">
      <a href="#policy">01 / Policy simulator</a><a href="#ledger">02 / Public ledger</a><a href="#townhall">03 / Town hall</a><a href="#spending">04 / Spending review</a><a href="#ai-safety">05 / AI safety participation</a><a href="#participation">06 / Public follow-through</a><a href="#model-evidence">07 / Model evidence</a><a href="#evaluations">08 / AI evaluations</a>
    </nav>
    <div className={styles.metrics}>
      <div><strong>{graph.nodes.length.toString().padStart(2, '0')}</strong><span>Illustrative proposal</span></div>
      <div><strong>{policy.primaryLegislativeSources.length.toString().padStart(2, '0')}</strong><span>Legislative source pointer</span></div>
      <div><strong>Open</strong><span>Evidence gaps disclosed</span></div>
      <div><strong>{currentAnchor && chain.data?.status === 'confirmed-finalized' ? 'Anchored' : 'Unanchored'}</strong><span>{ledger.data ? 'Loaded ledger head' : 'Live ledger connection required'}</span></div>
    </div>

    <Panel id="policy" number="01" title="Policy simulator & fact graph" intro="Change an assumption. Inspect the arithmetic, source context and tradeoffs.">
      <PolicySimulator graph={graph} policyId={policyId} onPolicyChange={setPolicyId} initialSimulation={initialSimulation} renderReceipt={receipt => <Receipt digest={receipt.digest} value={receipt} filename="civic-policy-scenario.json" />} />
    </Panel>

    <Panel id="ledger" number="02" title="Public transparency ledger" intro="Hash-linked records for contributions, expenses and operational decisions.">
      <div className={styles.columns}><div><span className={styles.badge}>Base / USDC · read only</span>
        <p>Records are appended through an operator service. Corrections require a new event. Each receipt binds its predecessor, sequence, ledger identity and evidence.</p>
        <p className={styles.muted}>Storage and on-chain anchoring are separate checks. A ledger digest cannot prove completeness or the accuracy of a contribution declaration.</p>
        <button type="button" disabled={ledger.busy} onClick={() => void ledger.refresh()}>{ledger.busy ? 'Loading…' : 'Refresh public records'}</button><Feedback {...ledger} />
      </div><div className={styles.result} aria-live="polite">
        {!ledger.data && <><p className={styles.eyebrow}>Connection status</p><h3>{ledger.busy ? 'Connecting to public records…' : 'Live connection unavailable'}</h3><p className={styles.muted}>No contributions or expenses are prefilled. Connect the append-only store to inspect public records.</p></>}
        {ledger.data && <><p className={styles.eyebrow}>{ledger.error ? 'Stale snapshot · refresh failed' : 'Server hash integrity checked · unanchored'}</p><h3>{ledger.data.head.sequence} stored events</h3><code className={styles.digest}>{ledger.data.head.digest}</code><p className={styles.muted}>{ledger.data.limitation}</p>
          {ledger.data.receipts.length === 0 && <p>No public events recorded.</p>}
          <p className={styles.muted}>{ledger.data.receipts.length} of {ledger.data.head.sequence} records loaded. {ledger.lastChecked && <>Last checked: <time dateTime={ledger.lastChecked}>{ledger.lastChecked}</time>.</>}</p>
          <button className={styles.secondary} type="button" onClick={() => downloadReceipt(ledgerFeedBundle(ledger.data!), 'civic-ledger-page.json')}>Download verifiable page</button>
          {ledger.data.hasMore && <button className={styles.secondary} type="button" disabled={ledger.busy} onClick={() => void ledger.refresh()}>Load more records</button>}
        </>}
      </div></div>
      <p className={styles.muted}>Refreshes every 15 seconds while this page is visible. Only events submitted to this civic ledger appear here; channel labels are operator declarations.</p>
      {ledger.data && ledger.data.receipts.length > 0 && <LedgerTable feed={ledger.data} renderReceipt={receipt => <Receipt digest={receipt.digest} value={receipt} filename={`civic-event-${receipt.sequence}.json`} />} />}
      <details className={styles.receipt}><summary>Verify a Base anchor</summary><p className={styles.muted}>Load the ledger first, then provide the independently obtained publisher and anchor transaction. Verification checks this loaded head against finalized Base calldata.</p>
        <form className={styles.form} onSubmit={e => { e.preventDefault(); if (ledger.data) void chain.run('/api/civic/verify-chain', { kind: 'anchor', checkpoint: ledger.data.head, publisher, transactionHash: anchorHash }) }}>
          <label htmlFor="civic-publisher">Declared publisher address</label><input id="civic-publisher" value={publisher} onChange={e => setPublisher(e.target.value)} required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" />
          <label htmlFor="civic-anchor">Anchor transaction hash</label><input id="civic-anchor" value={anchorHash} onChange={e => setAnchorHash(e.target.value)} required pattern="0x[0-9a-fA-F]{64}" placeholder="0x…" />
          <button type="submit" disabled={!ledger.data?.head.sequence || chain.busy}>Verify on Base</button>
        </form><Feedback {...chain} />
        {chain.data && <div role="status"><strong>{currentAnchor ? chain.data.status : 'Previous verification · recheck the current inputs'}</strong><p>{chain.data.reason}</p><p className={styles.muted}>{chain.data.limitation}</p></div>}
      </details>
    </Panel>

    <Panel id="townhall" number="03" title="Grounded town hall" intro="Ask about this proposal. Follow each answer back to its registry version and primary source.">
      <div className={styles.columns}><form onSubmit={ask} className={styles.form}>
        <span className={styles.badge}>Source retrieval · public preview</span>
        <p className={styles.muted}>Selected proposal: {policy.title}. Each question is evaluated independently against this registry node.</p>
        <label htmlFor="civic-question">Your policy question</label><textarea id="civic-question" value={question} onChange={e => setQuestion(e.target.value)} minLength={5} maxLength={2000} rows={5} required />
        <p className={styles.muted}>This preview retrieves bounded registry material. Optional AI classifies intent on the server; published facts remain constrained to the registry.</p>
        <div className={styles.quickQuestions}>{['What is the procurement proposal?', 'What evidence supports the projected savings?', 'What are the tradeoffs?', 'Is the proposal current law?', 'How will your anti-corruption policy impact federal healthcare spending?'].map(text => <button type="button" className={styles.secondary} key={text} onClick={() => setQuestion(text)}>{text}</button>)}</div>
        <button type="submit" disabled={townhall.busy}>{townhall.busy ? 'Retrieving…' : 'Ask the town hall'}</button><Feedback {...townhall} />
      </form><div className={styles.result} aria-live="polite">
        {!townhall.data && <><p className={styles.eyebrow}>Epistemic boundary</p><h3>“I don’t have enough evidence” is an answer.</h3><p className={styles.muted}>A historical source archive does not establish current law. Unsupported questions receive an explicit evidence gap.</p></>}
        {townhall.data && <><p className={styles.eyebrow}>{townhall.data.status.replaceAll('-', ' ')}</p><p className={styles.muted}>Question: {townhall.data.request.question}</p><h3>Answer</h3><p>{townhall.data.answer}</p>
          {townhall.data.passages.map((passage, i) => <blockquote key={i}><span className={styles.sourceNote}>{passage.kind.replaceAll('-', ' ')}</span>{passage.text}</blockquote>)}
          <h3>Tradeoffs</h3>{townhall.data.tradeoffs.length ? <ul>{townhall.data.tradeoffs.map(text => <li key={text}>{text}</li>)}</ul> : <p className={styles.muted}>Unavailable for this unmodeled policy area.</p>}
          <h3 className={styles.answerHeading}>Economic variables</h3>
          {townhall.data.economicVariables.length ? <><p className={styles.muted}>Illustrative registry assumptions. Supplied bounds have no specified statistical confidence level.</p><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Illustrative economic variables"><table className={styles.economicTable}><thead><tr><th scope="col">Variable</th><th scope="col">Baseline</th><th scope="col">Impact delta</th><th scope="col">Unit</th><th scope="col">Impact bounds</th></tr></thead><tbody>{townhall.data.economicVariables.map(variable => <tr key={variable.name}><th scope="row">{variable.name}</th><td>{number(variable.baselineValue)}</td><td>{number(variable.projectedImpactDelta)}</td><td>{variable.unit}</td><td>{variable.confidenceInterval.map(number).join(' to ')}</td></tr>)}</tbody></table></div></> : <p className={styles.muted}>No economic variables are available for this question.</p>}
          <h3 className={styles.answerHeading}>Counter-arguments</h3>{townhall.data.counterArguments.length ? <ul>{townhall.data.counterArguments.map(text => <li key={text}>{text}</li>)}</ul> : <p className={styles.muted}>Counter-arguments require a modeled proposal and supporting evidence; none is retrieved for this question.</p>}
          <h3 className={styles.answerHeading}>Primary legal citations</h3>
          {townhall.data.citations.length ? townhall.data.citations.map(citation => <p key={citation.id}><a href={citation.url} target="_blank" rel="noreferrer">[{citation.id}] {citation.citation} ↗</a><span className={styles.sourceNote}>{citation.scope}</span></p>) : <p className={styles.muted}>No applicable primary legal citation was retrieved for this question.</p>}
          {townhall.data.evidenceBasis && <p className={styles.muted}>Registry evidence basis: {townhall.data.evidenceBasis}</p>}
          <details><summary>Evidence limits</summary><ul>{townhall.data.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></details>
          <button type="button" className={styles.secondary} onClick={() => downloadText(townhall.data!.markdown, 'civic-townhall-answer.md', 'text/markdown;charset=utf-8')}>Download Markdown answer</button>
          <Receipt digest={townhall.data.digest} value={townhall.data} filename="civic-townhall-answer.json" />
        </>}
      </div></div>
      {history.length > 1 && <details className={styles.receipt}><summary>Previous exchanges in this session ({history.length - 1})</summary><p className={styles.muted}>The latest ten answers are held in this page’s memory. Reloading clears the session.</p>{history.slice(0, -1).map((answer, i) => <div key={`${answer.digest}-${i}`}><p><strong>{answer.request.question}</strong></p><p>{answer.answer}</p>{answer.citations.map(citation => <p key={citation.id}><a href={citation.url} target="_blank" rel="noreferrer">[{citation.id}] {citation.citation} ↗</a></p>)}<Receipt digest={answer.digest} value={answer} filename={`civic-townhall-exchange-${i + 1}.json`} /></div>)}</details>}
    </Panel>

    <Panel id="spending" number="04" title="Forensic spending review" intro="Inspect reported awards for budget discrepancies, concentration and noncompetitive procurement.">
      <div className={styles.columns}><form onSubmit={scan} className={styles.form}>
        <span className={styles.badge}>Synthetic example prefilled</span>
        <label htmlFor="civic-format">Dataset format</label><select id="civic-format" value={format} onChange={e => setFormat(e.target.value as 'json' | 'csv')}><option value="json">JSON records</option><option value="csv">CSV records</option></select>
        <label htmlFor="civic-spending">Paste spending records</label><textarea id="civic-spending" className={styles.codeInput} value={spending} onChange={e => setSpending(e.target.value)} rows={10} maxLength={200000} required />
        <details><summary>Required fields & CSV format</summary><p className={styles.muted}>One award per ID. Integer USD cents; group budget caps apply to agency + program + fiscal year. Sources require an HTTPS URL and citation.</p><code className={styles.digest}>id,agency,contractor,program,fiscalYear,amountUsdCents,budgetUsdCents,competition,sourceCitation,sourceUrl</code><p className={styles.muted}>competition: competitive, noncompetitive or unknown. JSON uses source: {'{ citation, url, digest? }'}. At most 1,000 records; 200,000 characters.</p></details>
        <label htmlFor="civic-concentration">Contractor share review threshold (%)</label><input id="civic-concentration" type="number" min="1" max="100" step="1" value={concentration} onChange={e => setConcentration(Number(e.target.value))} required />
        <label htmlFor="civic-award-threshold">Noncompetitive award review threshold (whole USD)</label><input id="civic-award-threshold" inputMode="numeric" pattern="(0|[1-9][0-9]{0,15})" value={noncompetitiveUsd} onChange={e => setNoncompetitiveUsd(e.target.value)} required />
        <button type="submit" disabled={audit.busy}>{audit.busy ? 'Scanning…' : 'Review spending records'}</button><Feedback {...audit} />
      </form><div className={styles.result} aria-live="polite">
        {!audit.data && <><p className={styles.eyebrow}>Review leads / no allegations</p><h3>Patterns need context.</h3><p className={styles.muted}>Concentration may reflect specialization. Noncompetitive contracts may have lawful exceptions. This scan cannot determine corruption, waste or regulatory capture.</p></>}
        {audit.data && <><p className={styles.eyebrow}>{audit.data.recordsScanned} records scanned · {audit.data.recordsIncludedInTotals} included in totals</p><h3>{audit.data.findings.length} review leads</h3><p>Reported total: <strong>{usd(audit.data.totalReportedUsdCents)}</strong></p>
          {audit.data.findings.length === 0 && <p>No configured rules triggered. This does not establish clean spending.</p>}
          <ol className={styles.records}>{audit.data.findings.map((finding, i) => <li key={i}><span className={styles.badge}>Review required</span><h4>{finding.rule.replaceAll('-', ' ')}</h4><p>{finding.explanation}</p><p className={styles.muted}>Observed: {finding.observed} · threshold: {finding.threshold ?? 'withheld'}</p><p className={styles.muted}>Records: {finding.recordIds.join(', ')}</p>{finding.sources.map(source => <a className={styles.sourceNote} key={source.url + source.citation} href={source.url} target="_blank" rel="noreferrer">{source.citation} ↗</a>)}</li>)}</ol>
          <details><summary>Audit limits</summary><ul>{audit.data.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></details>
          <Receipt digest={audit.data.digest} value={audit.data} filename="civic-spending-review.json" />
        </>}
      </div></div>
    </Panel>
    <Panel id="ai-safety" number="05" title="AI safety participation" intro="Share a concern, its evidence basis and what you want the platform to investigate.">
      <AiSafetyParticipation />
    </Panel>
    <Panel id="participation" number="06" title="Participation & public follow-through" intro="Inspect consented investigation summaries and compare alternatives in structured consultations."><PublicParticipation /></Panel>
    <Panel id="model-evidence" number="07" title="Model evidence & sensitivity" intro="Inspect model provenance, supply testing and reporting cost assumptions, and examine calibration gaps."><ModelEvidenceLab /></Panel>
    <Panel id="evaluations" number="08" title="Platform AI evaluation record" intro="Measured checks for claims, citations, abstention, prompt injection and selected privacy boundaries."><CivicAiEvaluations /></Panel>
  </div>
}
