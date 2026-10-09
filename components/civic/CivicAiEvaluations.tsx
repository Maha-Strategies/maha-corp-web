'use client'
import { useEffect, useState } from 'react'
import type { EvaluationReport } from '@/lib/civic/evaluation'
import styles from './CivicDashboard.module.css'
export default function CivicAiEvaluations() {
  const [report, setReport] = useState<EvaluationReport | null>(null), [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/civic/evaluations', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error)
      if (!controller.signal.aborted) setReport(body)
    }).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Evaluation unavailable.') })
    return () => controller.abort()
  }, [])
  return <div className={styles.result}>{report ? <>
    <h3>Measured checks: {report.passed} / {report.total} passed</h3><p>Run: {report.runAt} · suite {report.version}</p><p className={styles.muted}>{report.scope.replaceAll('-', ' ')}</p>
    <div className={styles.tableScroll}><table className={styles.economicTable}><thead><tr><th>Check</th><th>Category</th><th>Result</th></tr></thead><tbody>{report.cases.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.category}</td><td>{item.passed ? 'Passed' : 'Failed'}</td></tr>)}</tbody></table></div>
    <h4>Known limitations</h4><ul>{report.limitations.map(text => <li key={text}>{text}</li>)}</ul><details><summary>Inspect code, registry and report digests</summary><code className={styles.digest}>Code: {report.codeDigest}{'\n'}Registry: {report.registryDigest}{'\n'}Report: {report.digest}</code></details>
    <a href="/civic/evaluations/latest.json" download>Download measured report JSON</a>
  </> : <p role="status">{error || 'Loading the most recent measured evaluation…'}</p>}
    <p className={styles.muted}>The offline evaluation can run locally and on civic pull requests. No live model calls or automated production publication are performed.</p>
  </div>
}
