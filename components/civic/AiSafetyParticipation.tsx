'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AI_SAFETY_BASES, AI_SAFETY_TOPICS, aiSafetyReceiptSchema, aiSafetySubmissionSchema, type AiSafetyReceipt, type AiSafetySubmission } from '@/lib/civic/ai-safety'
import styles from './CivicDashboard.module.css'
import { newCaseAccessKey } from './case-access'

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function AiSafetyParticipation() {
  const [availability, setAvailability] = useState<'checking' | 'ready' | 'unavailable'>('checking')
  const [topic, setTopic] = useState<keyof typeof AI_SAFETY_TOPICS>('loss-of-control')
  const [basis, setBasis] = useState<keyof typeof AI_SAFETY_BASES>('concern')
  const [concern, setConcern] = useState(''), [requestedAction, setRequestedAction] = useState(''), [sources, setSources] = useState('')
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [saved, setSaved] = useState<{ receipt: AiSafetyReceipt; submission: AiSafetySubmission; accessKey: string } | null>(null)
  const attempt = useRef<{ key: string; id: string; accessKey: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/civic/ai-safety', { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!controller.signal.aborted) setAvailability(response.ok && data.accepting === true ? 'ready' : 'unavailable') })
      .catch(() => { if (!controller.signal.aborted) setAvailability('unavailable') })
    return () => controller.abort()
  }, [])
  function draft() {
    return { topic, basis, concern, requestedAction, sourceUrls: sources.split('\n').map(line => line.trim()).filter(Boolean), consentToPrivateReview: consent }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || saved) return
    setError('')
    const key = JSON.stringify(draft())
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID(), accessKey: newCaseAccessKey() }
    const parsed = aiSafetySubmissionSchema.safeParse({ ...draft(), submissionId: attempt.current.id })
    if (!parsed.success) { setError('Check the text lengths, consent and up to three HTTPS source links.'); return }
    download({ id: attempt.current.id, accessKey: attempt.current.accessKey, portal: '/civic/follow-up' }, 'civic-private-access-kit.json')
    setBusy(true)
    try {
      const response = await fetch('/api/civic/ai-safety', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-civic-case-key': attempt.current.accessKey }, body: JSON.stringify(parsed.data) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Your concern could not be submitted. Keep your draft and try again.')
      const receipt = aiSafetyReceiptSchema.parse(data.receipt)
      if (data.status !== 'received' || receipt.id !== parsed.data.submissionId) throw new Error('The acknowledgment could not be checked. Keep your draft and retry.')
      setSaved({ receipt, submission: parsed.data, accessKey: attempt.current.accessKey })
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Submission failed. Keep your draft and retry.') }
    finally { setBusy(false) }
  }
  return <div className={styles.columns}>
    <div>
      <span className={styles.badge}>Citizen participation · private review</span>
      <p>Share what worries you about AI and what you want this platform to investigate. Technical expertise and supporting evidence are welcome, but are not required.</p>
      <p className={styles.muted}>Submissions go to a private Maha operator inbox. They are not automatically published, added to the public ledger, sent to an AI model, or treated as verified facts. No reply or review deadline is guaranteed.</p>
      <p className={styles.muted}>Do not include names or contact details of private individuals, credentials, confidential documents, or instructions for exploiting a vulnerability. This is not an emergency service or a confidential whistleblower channel.</p>
      <div role="status"><p className={styles.muted}>{availability === 'checking' ? 'Checking the private inbox…' : availability === 'ready' ? 'Private inbox connected. You can submit a concern.' : 'The private inbox is not connected. You can prepare and download a draft; it will not be sent.'}</p></div>
      {saved ? <div className={styles.result} role="status">
        <h3>Concern received</h3><p>Saved to the private operator review inbox. This acknowledgment does not verify your concern or guarantee a response.</p>
        <p className={styles.muted}>Reference: {saved.receipt.id}<br />Received: <time dateTime={saved.receipt.receivedAt}>{saved.receipt.receivedAt}</time></p>
        <details><summary>Inspect your private receipt</summary><p className={styles.muted}>SHA-256 binds the submitted text and acknowledgment. It does not establish that an AI danger is real. Keep the download private; it contains your text.</p><code className={styles.digest}>{saved.receipt.digest}</code></details>
        <button type="button" className={styles.secondary} onClick={() => download(saved, 'civic-ai-safety-receipt.json')}>Download private receipt</button>
        <p><a href="/civic/follow-up">Open private follow-up</a>. Use your reference and the access key in the downloaded kit; keep both private.</p>
        <button type="button" className={styles.secondary} onClick={() => { setSaved(null); setConcern(''); setRequestedAction(''); setSources(''); setConsent(false); attempt.current = null; setError('') }}>Start another concern</button>
      </div> : <form className={styles.form} onSubmit={submit}>
        <fieldset className={styles.safetyFields} disabled={busy}>
          <label htmlFor="safety-topic">Area of concern</label><select id="safety-topic" value={topic} onChange={e => setTopic(e.target.value as typeof topic)}>{Object.entries(AI_SAFETY_TOPICS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label htmlFor="safety-basis">What is your concern based on?</label><select id="safety-basis" value={basis} onChange={e => setBasis(e.target.value as typeof basis)}>{Object.entries(AI_SAFETY_BASES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label htmlFor="safety-concern">Describe your AI safety concern</label><textarea id="safety-concern" minLength={20} maxLength={4000} rows={6} value={concern} onChange={e => setConcern(e.target.value)} required />
          <label htmlFor="safety-action">What should the platform investigate or change?</label><textarea id="safety-action" minLength={10} maxLength={1500} rows={3} value={requestedAction} onChange={e => setRequestedAction(e.target.value)} required />
          <label htmlFor="safety-sources">Public source links (optional)</label><textarea id="safety-sources" maxLength={3002} rows={3} placeholder="Up to three HTTPS links, one per line" value={sources} onChange={e => setSources(e.target.value)} aria-describedby="safety-source-help" />
          <p id="safety-source-help" className={styles.muted}>Links are submitted as review pointers. The platform does not fetch or verify their contents.</p>
          <label className={styles.consent} htmlFor="safety-consent"><input id="safety-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required />I agree to store this text for private operator review. I have removed sensitive personal or confidential information.</label>
          <button type="submit" disabled={availability !== 'ready' || busy}>{busy ? 'Submitting…' : 'Submit AI safety concern'}</button>
          <p className={styles.muted}>Submitting downloads a private access kit for status updates, clarification, correction and withdrawal. Save it before leaving this page. Lost keys cannot be recovered from a receipt reference.</p>
        </fieldset>
        <button type="button" className={styles.secondary} disabled={busy} onClick={() => download({ status: 'unsent-draft', ...draft() }, 'civic-ai-safety-unsent-draft.json')}>Download unsent draft</button>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </form>}
    </div>
    <aside className={styles.result}>
      <p className={styles.eyebrow}>How participation works</p><h3>Concerns deserve a clear evidence boundary.</h3>
      <ol className={styles.safetySteps}>
        <li><strong>You describe the concern.</strong> Separate what you observed, what a source reports, and what you think could happen.</li>
        <li><strong>The platform records it privately.</strong> A successful submission receives a reference and a downloadable receipt.</li>
        <li><strong>An operator can review it.</strong> Review states include reviewed, needs research and out of scope. These states do not certify factual accuracy.</li>
      </ol>
      <p className={styles.muted}>Policy simulation and the town hall still require modeled evidence. Submitting a concern does not create a policy forecast or a campaign promise.</p>
      <a href="#townhall">Inspect the town hall’s evidence limits ↑</a>
    </aside>
  </div>
}
