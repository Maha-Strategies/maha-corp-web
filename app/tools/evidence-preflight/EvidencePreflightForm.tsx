'use client'

import { useMemo, useState, type FormEvent } from 'react'

import { trackConversion } from '@/components/ConversionTracker'
import {
  EVIDENCE_PREFLIGHT_MAX_CLAIMS,
  type EvidencePreflightApiResponse,
  type EvidencePreflightClaimInput,
  type EvidencePreflightLocatorKind,
  type EvidencePreflightResult,
} from '@/lib/evidence-preflight-contract'

type DraftClaim = {
  claim: string
  sourceKind: 'doi' | 'url'
  identifier: string
  title: string
  publisher: string
  publicationDate: string
  excerpt: string
  locatorKind: EvidencePreflightLocatorKind
  locatorValue: string
  rightsBasis: EvidencePreflightClaimInput['rights']['basis']
  accessStatus: EvidencePreflightClaimInput['rights']['accessStatus']
  licenseOrPermission: string
}

const blankClaim = (): DraftClaim => ({
  claim: '', sourceKind: 'doi', identifier: '', title: '', publisher: '', publicationDate: '', excerpt: '',
  locatorKind: 'section', locatorValue: '', rightsBasis: 'unknown', accessStatus: 'unknown', licenseOrPermission: '',
})

function asInput(entry: DraftClaim): EvidencePreflightClaimInput {
  return {
    claim: entry.claim,
    source: {
      kind: entry.sourceKind,
      identifier: entry.identifier,
      title: entry.title || undefined,
      publisher: entry.publisher || undefined,
      publicationDate: entry.publicationDate || undefined,
    },
    excerpt: entry.excerpt || undefined,
    locator: entry.locatorValue ? { kind: entry.locatorKind, value: entry.locatorValue } : undefined,
    rights: {
      basis: entry.rightsBasis,
      accessStatus: entry.accessStatus,
      licenseOrPermission: entry.licenseOrPermission || undefined,
    },
  }
}

function downloadResult(result: EvidencePreflightResult) {
  const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `maha-evidence-preflight-${result.requestId}.json`
  link.click()
  URL.revokeObjectURL(url)
  trackConversion('cta_evidence_preflight_download')
}

export default function EvidencePreflightForm() {
  const [claims, setClaims] = useState<DraftClaim[]>([blankClaim()])
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<EvidencePreflightApiResponse | null>(null)

  const totalCharacters = useMemo(() => claims.reduce((total, claim) => total + claim.claim.length + claim.excerpt.length, 0), [claims])

  function update(index: number, patch: Partial<DraftClaim>) {
    setClaims((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
    setResponse(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setResponse(null)
    try {
      const requestId = `epf_${crypto.randomUUID()}`
      const request = {
        requestId,
        submissionConfirmedNonConfidential: confirmed,
        claims: claims.map(asInput),
      }
      const result = await fetch('/api/evidence-preflight', {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const body = await result.json() as EvidencePreflightApiResponse & { error?: { message?: string } }
      if (!result.ok) throw new Error(body.error?.message ?? 'The evidence preflight did not complete.')
      setResponse(body)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evidence preflight did not complete.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section id="run-preflight" className="evidence-section" aria-labelledby="preflight-form-title">
      <div className="evidence-inset">
        <p className="evidence-kicker">Browser submission · no content retention</p>
        <h2 id="preflight-form-title" className="evidence-section-title mt-4">Check up to three claims before deeper review.</h2>
        <p className="evidence-copy mt-4 max-w-3xl text-sm">
          Maha returns the submitted material in the response but does not store the claim, excerpt, source identifier, title or locator. A keyed metadata ledger enforces daily limits and request replay safety.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-7">
          {claims.map((entry, index) => (
            <fieldset key={index} className="border border-[var(--border-default)] bg-[var(--surface-paper)] p-5 sm:p-7">
              <legend className="px-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--status-sourced)]">Claim {index + 1}</legend>
              <label className="block text-sm font-semibold text-[var(--text-primary)]">
                Bounded claim
                <textarea value={entry.claim} onChange={(event) => update(index, { claim: event.target.value })} required minLength={8} maxLength={1000} rows={3} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal text-[var(--text-primary)]" placeholder="State one claim precisely, including its conditions and population where known." />
              </label>

              <div className="mt-5 grid gap-4 sm:grid-cols-[0.35fr_1fr]">
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Identifier type
                  <select value={entry.sourceKind} onChange={(event) => update(index, { sourceKind: event.target.value as DraftClaim['sourceKind'] })} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal">
                    <option value="doi">DOI</option><option value="url">HTTPS URL</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  DOI or public HTTPS URL
                  <input value={entry.identifier} onChange={(event) => update(index, { identifier: event.target.value })} required maxLength={500} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal" placeholder={entry.sourceKind === 'doi' ? '10.xxxx/identifier' : 'https://publisher.example/article'} />
                </label>
              </div>

              <details className="mt-4 border-l border-[var(--border-emphasis)] pl-4">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]">Optional source metadata</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Title<input value={entry.title} onChange={(event) => update(index, { title: event.target.value })} maxLength={300} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 normal-case tracking-normal text-[var(--text-primary)]" /></label>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Publisher<input value={entry.publisher} onChange={(event) => update(index, { publisher: event.target.value })} maxLength={200} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 normal-case tracking-normal text-[var(--text-primary)]" /></label>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">Publication date<input type="date" value={entry.publicationDate} onChange={(event) => update(index, { publicationDate: event.target.value })} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 normal-case tracking-normal text-[var(--text-primary)]" /></label>
                </div>
              </details>

              <label className="mt-5 block text-sm font-semibold text-[var(--text-primary)]">
                User-supplied source excerpt
                <textarea value={entry.excerpt} onChange={(event) => update(index, { excerpt: event.target.value })} maxLength={1500} rows={5} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal" placeholder="Paste only the short passage you are authorized to use. This preflight does not authenticate it against the source." />
              </label>

              <div className="mt-5 grid gap-4 sm:grid-cols-[0.35fr_1fr]">
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Locator type
                  <select value={entry.locatorKind} onChange={(event) => update(index, { locatorKind: event.target.value as DraftClaim['locatorKind'] })} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal">
                    {['page', 'section', 'paragraph', 'figure', 'table', 'equation', 'timestamp', 'other'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Exact locator
                  <input value={entry.locatorValue} onChange={(event) => update(index, { locatorValue: event.target.value })} maxLength={160} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal" placeholder="Page 12, section 3.2, Figure 4, or another bounded location" />
                </label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Rights basis
                  <select value={entry.rightsBasis} onChange={(event) => update(index, { rightsBasis: event.target.value as DraftClaim['rightsBasis'] })} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal">
                    <option value="unknown">Unknown</option><option value="public-domain">Public domain</option><option value="open-license">Open license</option><option value="permission-confirmed">Permission confirmed</option><option value="limited-quotation-review">Limited quotation for review</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Access status
                  <select value={entry.accessStatus} onChange={(event) => update(index, { accessStatus: event.target.value as DraftClaim['accessStatus'] })} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal">
                    <option value="unknown">Unknown</option><option value="open">Open</option><option value="restricted">Restricted</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-[var(--text-primary)]">
                  Licence or permission
                  <input value={entry.licenseOrPermission} onChange={(event) => update(index, { licenseOrPermission: event.target.value })} maxLength={240} className="mt-2 w-full border border-[var(--border-default)] bg-[var(--surface-raised)] p-3 font-normal" placeholder="e.g. CC BY 4.0" />
                </label>
              </div>

              {claims.length > 1 ? <button type="button" onClick={() => setClaims((current) => current.filter((_, entryIndex) => entryIndex !== index))} className="evidence-link mt-5 font-mono text-xs uppercase tracking-widest">Remove claim</button> : null}
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" disabled={claims.length >= EVIDENCE_PREFLIGHT_MAX_CLAIMS} onClick={() => setClaims((current) => [...current, blankClaim()])} className="evidence-action evidence-action--secondary disabled:cursor-not-allowed disabled:opacity-40">Add another claim ({claims.length}/{EVIDENCE_PREFLIGHT_MAX_CLAIMS})</button>
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">{totalCharacters.toLocaleString()} submitted characters</p>
          </div>

          <label className="flex gap-3 border border-[var(--status-unverified)] bg-[var(--surface-raised)] p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required className="mt-1 size-4 shrink-0" />
            <span>I confirm this submission contains no confidential, personal, privileged, export-controlled, unpublished restricted or otherwise sensitive material. I am authorized to submit the excerpts for automated structural analysis.</span>
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending || !confirmed} className="evidence-action evidence-action--primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Assessing structure…' : 'Run deterministic preflight'}</button>
            <p aria-live="polite" className="text-sm text-[var(--status-unverified)]">{error}</p>
          </div>
        </form>
      </div>

      {response ? <PreflightResult response={response} /> : null}
    </section>
  )
}

function PreflightResult({ response }: { response: EvidencePreflightApiResponse }) {
  const { result } = response
  return (
    <div className="mt-8 border border-[var(--border-default)] bg-[var(--surface-elevated)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="evidence-kicker">Deterministic result · {response.status}</p><h2 className="evidence-section-title mt-3">{result.summary.readyForSourceInspection}/{result.summary.claimCount} ready to enter source inspection</h2></div>
        <button type="button" onClick={() => downloadResult(result)} className="evidence-action evidence-action--secondary">Download digest-bound JSON</button>
      </div>
      <p className="mt-4 break-all font-mono text-[11px] leading-relaxed text-[var(--text-muted)]">{result.resultSha256}</p>
      <div className="mt-7 grid gap-5">
        {result.assessments.map((assessment) => (
          <article key={assessment.claimId} className="evidence-card">
            <div className="flex flex-wrap justify-between gap-3"><p className="evidence-kicker">{assessment.claimId}</p><p className="font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]">{assessment.readiness.replaceAll('-', ' ')}</p></div>
            <h3 className="evidence-card-title mt-3 text-lg">{assessment.claim}</h3>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <ResultField label="Source identity" value={assessment.source.identityStatus} />
              <ResultField label="Evidence" value={assessment.evidenceStatus} />
              <ResultField label="Locator" value={assessment.locatorStatus} />
              <ResultField label="Lexical coverage" value={assessment.lexicalCoverage.status} />
              <ResultField label="Claim scope" value={assessment.scopeAssessment.status} />
              <ResultField label="Rights/access" value={`${assessment.rightsAssessment.status} / ${assessment.rightsAssessment.accessStatus}`} />
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">{assessment.source.identityBoundary}</p>
            {assessment.blockers.length ? <div className="mt-5"><p className="evidence-kicker text-[var(--status-unverified)]">Blockers</p><ul className="mt-2 flex flex-wrap gap-2">{assessment.blockers.map((blocker) => <li key={blocker} className="border border-[var(--border-default)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{blocker}</li>)}</ul></div> : null}
          </article>
        ))}
      </div>
      <aside className="mt-8 border-l-2 border-[var(--status-unverified)] pl-5">
        <p className="evidence-kicker">Not a verified Evidence Dossier</p>
        <p className="evidence-copy mt-3 text-sm">No source was fetched or independently inspected. “Ready” means the submission has enough declared structure to enter a real source-review workflow; it does not mean the claim is supported or true.</p>
      </aside>
    </div>
  )
}

function ResultField({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{label}</dt><dd className="mt-1 text-[var(--text-primary)]">{value.replaceAll('-', ' ')}</dd></div>
}
