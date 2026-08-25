'use client'

import { useCallback, useMemo, useState } from 'react'

import { browserProvenanceDigest } from '@/lib/evidence-dossier/digest-browser'
import { canonicalJson } from '@/lib/evidence-dossier/canonical'
import {
  MAX_PAYLOAD_BYTES,
  NormalizationError,
  normalizeValue,
  parseBoundedJson,
  sanitizeExportFilename,
} from '@/lib/evidence-dossier/normalize'
import { validatePackage } from '@/lib/evidence-dossier/package-validator'
import { evidentiaryProjection, type DossierPackage } from '@/lib/evidence-dossier/package'
import styles from './operator.module.css'

/**
 * Local-only validation console.
 *
 * Everything runs in the browser. There is no fetch, no form action, no
 * analytics call and no navigation carrying content, so pasted material never
 * leaves the tab. Excerpts are rendered as text nodes by React; this file
 * contains no dangerouslySetInnerHTML.
 */

interface Issue {
  code: string
  path: string
  message: string
}

interface Result {
  issues: Issue[]
  pkg: DossierPackage | null
  recomputedDigest: string | null
  normalizedJson: string | null
}

export default function OperatorConsole() {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  const validate = useCallback(async (text: string) => {
    setBusy(true)
    try {
      let pkg: DossierPackage
      try {
        pkg = normalizeValue(parseBoundedJson(text)) as DossierPackage
      } catch (error) {
        const issue =
          error instanceof NormalizationError
            ? { code: 'normalization-failed', path: error.path, message: error.message }
            : { code: 'unreadable', path: '$', message: 'Could not read this file as JSON.' }
        setResult({ issues: [issue], pkg: null, recomputedDigest: null, normalizedJson: null })
        return
      }

      const issues = validatePackage(pkg)
      let recomputed: string | null = null
      try {
        recomputed = await browserProvenanceDigest(evidentiaryProjection(pkg))
      } catch {
        recomputed = null
      }
      setResult({
        issues,
        pkg: issues.length ? null : pkg,
        recomputedDigest: recomputed,
        normalizedJson: canonicalJson(pkg),
      })
    } finally {
      setBusy(false)
    }
  }, [])

  const onFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_PAYLOAD_BYTES) {
        setResult({
          issues: [
            {
              code: 'file-too-large',
              path: '$',
              message: `File is ${file.size} bytes; the limit is ${MAX_PAYLOAD_BYTES}.`,
            },
          ],
          pkg: null,
          recomputedDigest: null,
          normalizedJson: null,
        })
        return
      }
      const text = await file.text()
      setRaw(text)
      await validate(text)
    },
    [validate],
  )

  const download = useCallback((contents: string, suggested: string) => {
    const name = `${sanitizeExportFilename(suggested)}.json`
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const completeness = useMemo(() => {
    const pkg = result?.pkg
    if (!pkg) return null
    const passages = pkg.dossier.passages
    const sources = pkg.dossier.sources
    return {
      passagesWithLocator: passages.filter((passage) => Boolean(passage.locator)).length,
      passageTotal: passages.length,
      inspectedSources: sources.filter((source) => source.verificationState === 'document-inspected').length,
      sourceTotal: sources.length,
      sourcesWithRights: sources.filter((source) => Boolean(source.rightsBasis)).length,
      sourcesWithIdentifier: sources.filter((source) => Boolean(source.identifier)).length,
    }
  }, [result])

  const pkg = result?.pkg ?? null

  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        <div className={styles.localBanner}>
          <p className={styles.localLabel}>Local validation only — content is not uploaded or published</p>
          <p className={styles.copy}>
            This console validates a dossier package inside your browser. Nothing is sent to a server, stored,
            indexed, or promoted. Closing the tab discards everything.
          </p>
        </div>

        <h1 className={styles.h1}>Evidence dossier operator console</h1>

        <section className={styles.noPrint}>
          <h2 className={styles.h2}>1. Load a package</h2>
          <label className={styles.label} htmlFor="dossier-file">
            Local JSON file
          </label>
          <input
            id="dossier-file"
            type="file"
            accept="application/json,.json"
            className={styles.input}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onFile(file)
            }}
          />

          <label className={styles.label} htmlFor="dossier-json">
            Or paste the package
          </label>
          <textarea
            id="dossier-json"
            className={styles.textarea}
            value={raw}
            spellCheck={false}
            placeholder="Paste a dossier package JSON document here."
            onChange={(event) => setRaw(event.target.value)}
          />

          <div className={styles.actions}>
            <button type="button" className={styles.action} disabled={busy || !raw.trim()} onClick={() => void validate(raw)}>
              {busy ? 'Validating…' : 'Validate locally'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={!result?.normalizedJson}
              onClick={() => result?.normalizedJson && download(result.normalizedJson, `${pkg?.packageId ?? 'package'}-normalized`)}
            >
              Export normalized JSON
            </button>
            <button type="button" className={styles.action} disabled={!pkg} onClick={() => window.print()}>
              Print-ready preview
            </button>
          </div>
        </section>

        {result && result.issues.length > 0 && (
          <section>
            <h2 className={styles.h2}>Validation failed — {result.issues.length} issue(s)</h2>
            <p className={styles.copy}>Nothing is previewed until every issue is resolved.</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>JSON path</th>
                    <th>Code</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {result.issues.map((issue) => (
                    <tr key={`${issue.code}-${issue.path}-${issue.message}`}>
                      <td className={styles.mono}>{issue.path}</td>
                      <td className={styles.mono}>{issue.code}</td>
                      <td>{issue.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {pkg && completeness && (
          <>
            <section>
              <h2 className={styles.h2}>2. Completeness</h2>
              <ul className={styles.list}>
                <li>
                  Passages with an exact locator: {completeness.passagesWithLocator} of {completeness.passageTotal}
                </li>
                <li>
                  Sources directly inspected: {completeness.inspectedSources} of {completeness.sourceTotal}
                </li>
                <li>
                  Sources with a rights basis: {completeness.sourcesWithRights} of {completeness.sourceTotal}
                </li>
                <li>
                  Sources with a stable identifier: {completeness.sourcesWithIdentifier} of {completeness.sourceTotal}
                </li>
              </ul>
            </section>

            <section>
              <h2 className={styles.h2}>3. Comparison compatibility</h2>
              {pkg.dossier.comparisons.length === 0 && <p className={styles.copy}>No comparison in this package.</p>}
              {pkg.dossier.comparisons.map((comparison) => (
                <div key={comparison.comparisonId}>
                  <p className={styles.copy}>
                    <span className={styles.mono}>{comparison.relation}</span> —{' '}
                    {comparison.axes.filter((axis) => axis.comparable).length} of {comparison.axes.length} axes comparable
                  </p>
                  <ul className={styles.list}>
                    {comparison.axes.map((axis) => (
                      <li key={axis.axis}>
                        {axis.axis}: {axis.comparable ? 'comparable' : 'not comparable'} — {axis.note}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.copy}>{comparison.replicationAssessment}</p>
                </div>
              ))}
            </section>

            <section>
              <h2 className={styles.h2}>4. Prohibited inferences</h2>
              <ul className={styles.list}>
                {pkg.dossier.unsupportedInferences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {pkg.dossier.claims.flatMap((claim) =>
                  claim.unsupportedExtensions.map((item) => <li key={`${claim.claimId}-${item}`}>{item}</li>),
                )}
              </ul>
            </section>

            <section>
              <h2 className={styles.h2}>5. Digests</h2>
              <p className={styles.label}>Supplied payload digest</p>
              <p className={styles.mono}>{pkg.canonicalPayloadDigest}</p>
              <p className={styles.label}>Recomputed in this browser</p>
              <p className={styles.mono}>{result?.recomputedDigest ?? 'not computed'}</p>
              <p className={styles.copy}>
                {result?.recomputedDigest === pkg.canonicalPayloadDigest
                  ? 'The recomputed digest matches the supplied value.'
                  : 'The recomputed digest does not match. Treat the supplied value as untrusted.'}
              </p>
              <p className={styles.label}>Parent digest</p>
              <p className={styles.mono}>{pkg.parentDigest ?? 'none (first revision)'}</p>
            </section>

            <section>
              <h2 className={styles.h2}>6. Preview</h2>
              <p className={styles.label}>Review state</p>
              <p className={styles.mono}>{pkg.reviewState}</p>
              <p className={styles.label}>Inquiry</p>
              <p className={styles.copy}>{pkg.dossier.inquiry}</p>
              {pkg.dossier.claims.map((claim) => (
                <div key={claim.claimId} className={styles.claim}>
                  <p className={styles.mono}>{claim.epistemicStatus}</p>
                  <p className={styles.copy}>{claim.auditedStatement}</p>
                  <p className={styles.label}>As submitted</p>
                  <p className={styles.copy}>{claim.submittedStatement}</p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
