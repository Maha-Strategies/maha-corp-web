import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import {
  BRIEFS,
  PUBLIC_INTELLIGENCE_BRIEF_SLUGS,
  INTELLIGENCE_BRIEF_ARCHIVE,
  getAllBriefSlugs,
  getBriefBySlug,
} from '../lib/briefs-data.ts'

const intelligenceRoot = path.join(process.cwd(), 'app', 'intelligence')

function collectPublicRouteSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) return collectPublicRouteSource(entryPath)

      return /\.(?:ts|tsx|js|jsx|json|md|mdx)$/.test(entry.name)
        ? [readFileSync(entryPath, 'utf8')]
        : []
    })
    .join('\n')
}

const prohibitedPublicPatterns = [
  /flash[-\s]?opinions?/i,
  /uzabase/i,
  /\bsupplied (?:assessment|product hypothesis|willingness-to-pay hypothesis|competitive assessment)\b/i,
  /\bwillingness[-\s]to[-\s]pay\b/i,
  /\bWTP\b/,
  /\bsurvey results?\b/i,
  /\bpaid response\b/i,
  /\bpayment metadata\b/i,
]

test('all archived research has a separate sanitized public edition', () => {
  assert.equal(BRIEFS.length, 41)
  assert.deepEqual(BRIEFS.map((brief) => brief.slug), PUBLIC_INTELLIGENCE_BRIEF_SLUGS)
  assert.deepEqual(getAllBriefSlugs(), PUBLIC_INTELLIGENCE_BRIEF_SLUGS)
  assert.deepEqual(
    new Set(BRIEFS.map((brief) => brief.slug)),
    new Set(INTELLIGENCE_BRIEF_ARCHIVE.map((brief) => brief.slug)),
  )
})

test('restored briefs are public editions rather than archive object references', () => {
  for (const archived of INTELLIGENCE_BRIEF_ARCHIVE) {
    const publicBrief = getBriefBySlug(archived.slug)
    assert.ok(publicBrief)
    assert.notEqual(publicBrief, archived)
    assert.equal(publicBrief.publicEditionBoundary?.reviewState, 'sanitized-public-edition')
    assert.equal(publicBrief.dateModified, '2026-08-28')

    if (archived.slug !== 'ai-software-cost-trajectory-2040') {
      assert.notEqual(publicBrief.title, archived.title)
    }
  }
})

test('sanitized public records exclude engagement-specific language', () => {
  const serializedPublicProjection = JSON.stringify(BRIEFS)

  for (const pattern of prohibitedPublicPatterns) {
    assert.doesNotMatch(serializedPublicProjection, pattern)
  }
})

test('the public intelligence route excludes third-party confidential-service identifiers', () => {
  const publicSource = collectPublicRouteSource(intelligenceRoot)

  assert.doesNotMatch(publicSource, /flash[-\s]?opinions?/i)
  assert.doesNotMatch(publicSource, /uzabase/i)
})
