#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const [, , epubInput, markdownOutput] = process.argv

if (!epubInput || !markdownOutput) {
  console.error('Usage: node scripts/import-maha-principle-epub.mjs <source.epub> <output.md>')
  process.exit(1)
}

const temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'maha-principle-import-'))
const converted = resolve(temporaryDirectory, 'converted.md')

try {
  const result = spawnSync(
    'pandoc',
    [resolve(epubInput), '--to=gfm', '--wrap=none', '--output', converted],
    { encoding: 'utf8' },
  )

  if (result.status !== 0) {
    console.error(result.stderr || 'Pandoc failed to convert the EPUB.')
    process.exit(result.status ?? 1)
  }

  const source = readFileSync(converted, 'utf8').replace(/\r\n/g, '\n')
  const firstSection = source.indexOf('# MEDICAL DISCLAIMER AND NOTICE OF LIABILITY')
  if (firstSection === -1) throw new Error('The expected first section was not found in the converted EPUB.')

  const markdown = source
    .slice(firstSection)
    .replace(/<\/?(?:div|span)(?:\s[^>]*)?>/g, '')
    .replace(/<\/?(?:label|sup)(?:\s[^>]*)?>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n')

  if (/<\/?(?:div|span|label|sup)(?:\s[^>]*)?>/.test(markdown)) {
    throw new Error('Unsupported EPUB wrapper markup remains after conversion.')
  }

  mkdirSync(dirname(resolve(markdownOutput)), { recursive: true })
  writeFileSync(resolve(markdownOutput), markdown, 'utf8')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
