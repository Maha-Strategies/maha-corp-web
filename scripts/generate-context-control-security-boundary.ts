/**
 * Renders the security and data-boundary one-pager and its source manifest.
 *
 * Markdown, PDF and manifest all come from one claim model, so the three
 * cannot disagree. Makes no network call. Pass --check to verify the committed
 * files still reproduce instead of rewriting them.
 */
import { readFileSync, writeFileSync } from 'node:fs'

import {
  BOUNDARY_MANIFEST_PATH,
  BOUNDARY_MARKDOWN_PATH,
  BOUNDARY_PDF_PATH,
  buildSourceManifest,
  sha256File,
} from '../lib/security/context-control-boundary.ts'
import { renderBoundaryMarkdown } from '../lib/security/context-control-boundary-markdown.ts'
import { renderBoundaryPdf } from '../lib/security/context-control-boundary-pdf.ts'

const checkOnly = process.argv.includes('--check')

const markdown = renderBoundaryMarkdown()
const manifest = `${JSON.stringify(buildSourceManifest(), null, 2)}\n`
const pdf = await renderBoundaryPdf()

if (checkOnly) {
  const failures: string[] = []
  if (readFileSync(BOUNDARY_MARKDOWN_PATH, 'utf8') !== markdown) failures.push(`${BOUNDARY_MARKDOWN_PATH} does not reproduce.`)
  if (readFileSync(BOUNDARY_MANIFEST_PATH, 'utf8') !== manifest) failures.push(`${BOUNDARY_MANIFEST_PATH} does not reproduce.`)
  if (!Buffer.from(readFileSync(BOUNDARY_PDF_PATH)).equals(Buffer.from(pdf))) failures.push(`${BOUNDARY_PDF_PATH} does not reproduce.`)
  if (failures.length > 0) { for (const failure of failures) console.error(failure); process.exit(1) }
  console.log(JSON.stringify({ status: 'reproduced', providerCallsMade: 0 }, null, 2))
} else {
  writeFileSync(BOUNDARY_MARKDOWN_PATH, markdown)
  writeFileSync(BOUNDARY_MANIFEST_PATH, manifest)
  writeFileSync(BOUNDARY_PDF_PATH, pdf)
  console.log(JSON.stringify({
    status: 'written',
    markdown: BOUNDARY_MARKDOWN_PATH,
    markdownSha256: `sha256:${sha256File(BOUNDARY_MARKDOWN_PATH)}`,
    manifest: BOUNDARY_MANIFEST_PATH,
    manifestSha256: `sha256:${sha256File(BOUNDARY_MANIFEST_PATH)}`,
    pdf: BOUNDARY_PDF_PATH,
    pdfSha256: `sha256:${sha256File(BOUNDARY_PDF_PATH)}`,
    providerCallsMade: 0,
  }, null, 2))
}
