import type { Metadata } from 'next'

import { DEMONSTRATION_DOSSIER as dossier } from '@/lib/evidence-dossier/demonstration'
import { ANTIGRAVITY_EXAMPLE_FINDINGS } from '@/lib/evidence-dossier/antigravity-example-audit'
import { validateDossier } from '@/lib/evidence-dossier/validator'
import styles from './dossier-report.module.css'

// Derived from the dossier so the title cannot drift behind the revision.
const revision = dossier.corpusRevision.split('/').pop() ?? '0'

export const metadata: Metadata = {
  title: `Evidence Dossier v${revision} (draft demonstration) | Maha Strategies`,
  description: 'Internal demonstration of the evidence dossier format. Illustrative draft; not published.',
  robots: { index: false, follow: false, nocache: true },
}

/*
 * Read-only demonstration render. Not linked from navigation, not in the
 * sitemap, not in llms.txt, and noindex. It renders the dossier only if the
 * dossier validates, so an invalid record cannot be displayed.
 */

const STATUS_CLASS: Record<string, string> = {
  'passage-supports-bounded-claim': styles.statusSupported,
  'source-metadata-verified': styles.statusMetadata,
}

export default function EvidenceDossierDemonstrationPage() {
  const issues = validateDossier(dossier)
  const sourceById = new Map(dossier.sources.map((source) => [source.sourceId, source]))
  const passageById = new Map(dossier.passages.map((passage) => [passage.passageId, passage]))

  if (issues.length) {
    return (
      <main className={styles.page}>
        <div className={styles.sheet}>
          <div className={styles.draftBanner}>
            <p className={styles.draftLabel}>Not rendered — dossier failed validation</p>
            <ul className={styles.list}>
              {issues.map((issue) => (
                <li key={`${issue.code}-${issue.path}`}>
                  {issue.code} at {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <div className={styles.draftBanner}>
          <p className={styles.draftLabel}>
            Draft · review state: {dossier.reviewState} · not externally reviewed
          </p>
          <p className={`${styles.copy} mt-2`}>{dossier.disclaimer}</p>
        </div>

        <p className={styles.meta}>
          {dossier.dossierId} · {dossier.domainId} · generated {dossier.generatedAt} · corpus{' '}
          {dossier.corpusRevision}
        </p>
        <h1 className={styles.h1}>{dossier.title}</h1>
        <p className={styles.copy}>{dossier.inquiry}</p>

        <h2 className={styles.h2}>What was checked</h2>
        <p className={styles.copy}>{dossier.methodology}</p>
        <p className={styles.label}>Intended use</p>
        <p className={styles.copy}>{dossier.intendedUse}</p>
        <p className={styles.label}>Prohibited uses</p>
        <ul className={styles.list}>
          {dossier.prohibitedUses.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>

        <h2 className={styles.h2}>Sources</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Identifier</th>
                <th>Type</th>
                <th>How far checking went</th>
                <th>Rights basis</th>
              </tr>
            </thead>
            <tbody>
              {dossier.sources.map((source) => (
                <tr key={source.sourceId}>
                  <td>{source.submittedCitation}</td>
                  <td className={styles.digest}>{source.identifier ?? '—'}</td>
                  <td>{source.publicationType}</td>
                  <td>
                    {source.verificationState}
                    <br />
                    <span className={styles.meta}>{source.metadataProvenance}</span>
                  </td>
                  <td>{source.rightsBasis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className={styles.h2}>Claims ({dossier.claims.length})</h2>
        {dossier.claims.map((claim) => (
          <section key={claim.claimId} className={styles.claim}>
            <span className={`${styles.status} ${STATUS_CLASS[claim.epistemicStatus] ?? ''}`}>
              {claim.epistemicStatus}
            </span>
            <h3 className={`${styles.h3} mt-3`}>{claim.auditedStatement}</h3>

            <p className={styles.label}>As submitted</p>
            <p className={styles.copy}>{claim.submittedStatement}</p>

            {claim.passageIds.length > 0 && (
              <>
                <p className={styles.label}>Evidence</p>
                {claim.passageIds.map((passageId) => {
                  const passage = passageById.get(passageId)
                  if (!passage) return null
                  const source = sourceById.get(passage.sourceId)
                  return (
                    <div key={passageId} className="mt-2">
                      <p className={styles.locator}>
                        {source?.publicationType} · {passage.locator}
                        {passage.isParaphrase ? ' · paraphrase' : ' · verbatim'} ·{' '}
                        {passage.originalDocumentInspected ? 'document inspected' : 'not inspected'}
                      </p>
                      <p className={`${styles.quote} mt-1`}>{passage.excerpt}</p>
                    </div>
                  )
                })}
              </>
            )}

            <p className={styles.label}>Scope of the check</p>
            <p className={styles.copy}>{claim.verificationScope}</p>

            <p className={styles.label}>Uncertainty</p>
            <p className={styles.copy}>{claim.uncertainty}</p>

            {claim.disagreements.length > 0 && (
              <>
                <p className={styles.label}>Disagreements</p>
                <ul className={styles.list}>
                  {claim.disagreements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            <p className={styles.label}>What this does not support</p>
            <ul className={styles.list}>
              {claim.unsupportedExtensions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className={styles.label}>Claim digest</p>
            <p className={styles.digest}>{claim.provenanceDigest}</p>
          </section>
        ))}

        <h2 className={styles.h2}>Source comparison</h2>
        {dossier.comparisons.map((comparison) => (
          <section key={comparison.comparisonId}>
            <p className={styles.copy}>{comparison.question}</p>
            <p className={styles.label}>Relation</p>
            <p className={`${styles.status} ${styles.statusMetadata}`}>{comparison.relation}</p>
            <p className={`${styles.copy} mt-3`}>{comparison.relationRationale}</p>

            <p className={styles.label}>Axis-by-axis</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Axis</th>
                    {comparison.sourceIds.map((sourceId) => (
                      <th key={sourceId}>{sourceById.get(sourceId)?.submittedCitation.split('(')[0].trim()}</th>
                    ))}
                    <th>Comparable</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.axes.map((axis) => (
                    <tr key={axis.axis}>
                      <td>{axis.axis}</td>
                      {comparison.sourceIds.map((sourceId) => (
                        <td key={sourceId}>{axis.values[sourceId] ?? '—'}</td>
                      ))}
                      <td>
                        {axis.comparable ? 'yes' : 'no'}
                        <br />
                        <span className={styles.meta}>{axis.note}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className={styles.label}>Where they agree</p>
            <ul className={styles.list}>
              {comparison.agreements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            {comparison.qualifications.length > 0 && (
              <>
                <p className={styles.label}>Where one qualifies the other</p>
                <ul className={styles.list}>
                  {comparison.qualifications.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}

            <p className={styles.label}>Comparability limits</p>
            <ul className={styles.list}>
              {comparison.comparabilityLimits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <p className={styles.label}>Is this replication?</p>
            <p className={styles.copy}>{comparison.replicationAssessment}</p>

            <p className={styles.label}>Comparison digest</p>
            <p className={styles.digest}>{comparison.provenanceDigest}</p>
          </section>
        ))}

        <h2 className={styles.h2}>Prior revisions</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Superseded</th>
                <th>Digest</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {dossier.priorRevisions.map((revision) => (
                <tr key={revision.version}>
                  <td>{revision.version}</td>
                  <td>{revision.supersededAt}</td>
                  <td className={styles.digest}>{revision.dossierDigest}</td>
                  <td>{revision.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className={styles.h2}>Contradictions</h2>
        <ul className={styles.list}>
          {dossier.contradictions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className={styles.h2}>Unsupported inferences</h2>
        <ul className={styles.list}>
          {dossier.unsupportedInferences.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className={styles.h2}>Limitations</h2>
        <ul className={styles.list}>
          {dossier.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className={styles.h2}>Provenance</h2>
        <p className={styles.copy}>
          Digest algorithm {dossier.provenanceBundle.digestAlgorithm}, canonicalization{' '}
          {dossier.provenanceBundle.canonicalizationVersion}. {dossier.provenanceBundle.sourceCount} sources,{' '}
          {dossier.provenanceBundle.passageCount} passages, {dossier.provenanceBundle.claimCount} claims. The
          digest covers every evidentiary field and excludes itself.
        </p>
        <p className={styles.digest}>{dossier.provenanceBundle.dossierDigest}</p>

        <h2 className={styles.h2}>Rejected example claims</h2>
        <p className={styles.copy}>
          The commercial brief that prompted this format supplied its own demonstration record. Every checkable
          element of it was rechecked. None of its example claims survived.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Element</th>
                <th>Verdict</th>
                <th>Finding</th>
              </tr>
            </thead>
            <tbody>
              {ANTIGRAVITY_EXAMPLE_FINDINGS.map((finding) => (
                <tr key={finding.ref}>
                  <td>{finding.ref}</td>
                  <td>{finding.verdict}</td>
                  <td>{finding.finding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </main>
  )
}
