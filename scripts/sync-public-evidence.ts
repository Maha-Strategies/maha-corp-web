/**
 * Publishes byte-identical static copies of the canonical evidence PDFs.
 *
 * The canonical documents stay under content/, where their generators and
 * validators live. Next.js does not serve content/, so a buyer following a link
 * needs a copy under public/. Two copies of the same bytes is a drift risk, so
 * this is the only supported way to make them and `--check` is what CI runs:
 * a public copy that no longer matches its canonical source fails rather than
 * quietly serving a stale document.
 *
 *   npm run sync:public-evidence
 *   npm run sync:public-evidence -- --check
 */
import { copyFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

export const PUBLIC_EVIDENCE_COPIES = [
  {
    id: 'context-control-evidence-assessment-sample',
    canonical: 'content/assessments/context-control-evidence-assessment-sample.pdf',
    published: 'public/assessments/context-control-evidence-assessment-sample.pdf',
    webPath: '/assessments/context-control-evidence-assessment-sample.pdf',
  },
  {
    id: 'wso2-live-evaluation-evidence',
    canonical: 'content/integrations/wso2-live-evaluation-evidence.json',
    published: 'public/benchmarks/wso2/live-evaluation-evidence.json',
    webPath: '/benchmarks/wso2/live-evaluation-evidence.json',
  },
  {
    id: 'context-control-security-boundary',
    canonical: 'content/security/context-control-security-boundary.pdf',
    published: 'public/security/context-control-security-boundary.pdf',
    webPath: '/security/context-control-security-boundary.pdf',
  },
] as const

const digest = (path: string) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`

const checkOnly = process.argv.includes('--check')
const drift: string[] = []
const report: Record<string, string>[] = []

for (const entry of PUBLIC_EVIDENCE_COPIES) {
  const canonical = digest(entry.canonical)
  if (checkOnly) {
    let published: string | null = null
    try { published = digest(entry.published) } catch { published = null }
    if (published !== canonical) {
      drift.push(`${entry.published} does not match ${entry.canonical} (${published ?? 'missing'} vs ${canonical})`)
    }
  } else {
    copyFileSync(entry.canonical, entry.published)
  }
  report.push({ id: entry.id, webPath: entry.webPath, sha256: canonical })
}

if (drift.length > 0) {
  for (const problem of drift) console.error(problem)
  console.error('Run: npm run sync:public-evidence')
  process.exit(1)
}

console.log(JSON.stringify({ status: checkOnly ? 'in-sync' : 'synced', copies: report }, null, 2))
