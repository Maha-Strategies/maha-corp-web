/**
 * Zero-cost, network-free validation of the security boundary one-pager.
 * This is the command the document itself tells a reviewer to run.
 */
import { readFileSync } from 'node:fs'

import {
  BOUNDARY_MANIFEST_PATH,
  BOUNDARY_MARKDOWN_PATH,
  BOUNDARY_PDF_PATH,
  ALL_CLAIMS,
  sha256File,
} from '../lib/security/context-control-boundary.ts'
import {
  findMissingBoundaries,
  findMissingSections,
  findProhibited,
  findSensitive,
  findUnbackedClaims,
  findUnrenderedClaims,
} from '../lib/security/context-control-boundary-checks.ts'

const markdown = readFileSync(BOUNDARY_MARKDOWN_PATH, 'utf8')
const manifest = JSON.parse(readFileSync(BOUNDARY_MANIFEST_PATH, 'utf8'))
const failures: string[] = []

const report = (label: string, problems: string[]): void => {
  if (problems.length > 0) failures.push(`${label}: ${problems.join(', ')}`)
}

report('missing required sections', findMissingSections())
report('prohibited claims present', findProhibited(markdown))
report('required boundaries missing', findMissingBoundaries(markdown))
report('sensitive strings present', findSensitive(markdown))
report('claims not backed by a current source', findUnbackedClaims(manifest))
report('claims in the model but not in the document', findUnrenderedClaims(markdown))

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'valid',
  markdown: BOUNDARY_MARKDOWN_PATH,
  markdownSha256: `sha256:${sha256File(BOUNDARY_MARKDOWN_PATH)}`,
  pdf: BOUNDARY_PDF_PATH,
  pdfSha256: `sha256:${sha256File(BOUNDARY_PDF_PATH)}`,
  manifest: BOUNDARY_MANIFEST_PATH,
  claims: ALL_CLAIMS.length,
  distinctSources: manifest.sources.length,
  everyClaimBacked: true,
  prohibitedClaims: 0,
  providerCallsMade: 0,
}, null, 2))
